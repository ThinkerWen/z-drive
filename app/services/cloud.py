from __future__ import annotations

import hashlib
import mimetypes
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from fastapi import UploadFile
from PIL import Image as PILImage, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.cloud_item import DriveItem
from app.models.cloud_share import DriveShare, DriveShareAccessLog


class DriveService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _drive_root(self) -> Path:
        return Path(self.settings.storage_path) / "cloud"

    def _thumbnail_root(self) -> Path:
        return self._drive_root() / ".thumbnails"

    def ensure_directories(self) -> None:
        self._drive_root().mkdir(parents=True, exist_ok=True)
        self._thumbnail_root().mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _clean_name(name: str) -> str:
        cleaned = name.strip().replace("/", "_").replace("\\", "_")
        return cleaned[:255] or "untitled"

    def _resolve_parent(self, db: Session, parent_id: int | None) -> DriveItem | None:
        if parent_id is None:
            return None
        parent = db.scalar(select(DriveItem).where(DriveItem.id == parent_id, DriveItem.is_delete.is_(False)))
        if parent is None or not parent.is_folder:
            raise LookupError("父目录不存在")
        return parent

    @staticmethod
    def _exists_sibling(db: Session, parent_id: int | None, name: str, exclude_id: int | None = None) -> bool:
        stmt = select(DriveItem.id).where(
            DriveItem.parent_id == parent_id,
            DriveItem.name == name,
            DriveItem.is_delete.is_(False),
        )
        if exclude_id is not None:
            stmt = stmt.where(DriveItem.id != exclude_id)
        return db.scalar(stmt) is not None

    @staticmethod
    def _join_rel(parent_path: str, name: str) -> str:
        return f"{parent_path}/{name}" if parent_path else name

    def _unique_name(self, db: Session, parent_id: int | None, base_name: str) -> str:
        if not self._exists_sibling(db, parent_id, base_name):
            return base_name

        stem = Path(base_name).stem
        suffix = Path(base_name).suffix
        index = 1
        while True:
            candidate = f"{stem} ({index}){suffix}"
            if not self._exists_sibling(db, parent_id, candidate):
                return candidate
            index += 1

    @staticmethod
    def _depth(path_text: str) -> int:
        return path_text.count("/")

    @staticmethod
    def _is_inside_path(target_path: str, parent_path: str) -> bool:
        return target_path == parent_path or target_path.startswith(f"{parent_path}/")

    def _children_recursive(self, db: Session, folder_path: str) -> list[DriveItem]:
        return db.scalars(
            select(DriveItem).where(
                DriveItem.is_delete.is_(False),
                DriveItem.storage_path.like(f"{folder_path}/%"),
            )
        ).all()

    def list_items(
        self,
        db: Session,
        parent_id: int | None,
        query: str,
        sort_by: str,
        order: str,
        file_type: str,
        created_from: str,
        created_to: str,
    ) -> list[DriveItem]:
        filters = [DriveItem.is_delete.is_(False)]
        if parent_id is None:
            filters.append(DriveItem.parent_id.is_(None))
        else:
            filters.append(DriveItem.parent_id == parent_id)
        if query:
            filters.append(DriveItem.name.like(f"%{query}%"))
        if file_type and file_type != "all":
            if file_type == "folder":
                filters.append(DriveItem.is_folder.is_(True))
            else:
                filters.append(DriveItem.is_folder.is_(False))
                filters.append(DriveItem.file_ext == file_type.lower())
        if created_from:
            filters.append(func.date(DriveItem.created_at) >= created_from)
        if created_to:
            filters.append(func.date(DriveItem.created_at) <= created_to)

        order_map = {
            "name": DriveItem.name,
            "time": DriveItem.created_at,
            "size": DriveItem.file_size,
        }
        sort_col = order_map.get(sort_by, DriveItem.name)
        sort_expr = sort_col.desc() if order.lower() == "desc" else sort_col.asc()

        return db.scalars(select(DriveItem).where(*filters).order_by(DriveItem.is_folder.desc(), sort_expr)).all()

    def create_folder(self, db: Session, parent_id: int | None, name: str) -> DriveItem:
        parent = self._resolve_parent(db, parent_id)
        safe_name = self._clean_name(name)
        folder_name = self._unique_name(db, parent_id, safe_name)

        parent_path = parent.storage_path if parent else ""
        relative_path = self._join_rel(parent_path, folder_name)
        (self._drive_root() / relative_path).mkdir(parents=True, exist_ok=True)

        item = DriveItem(
            parent_id=parent_id,
            name=folder_name,
            is_folder=True,
            storage_path=relative_path,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    async def upload_files(self, db: Session, parent_id: int | None, files: list[UploadFile]) -> tuple[list[DriveItem], list[dict[str, str]]]:
        items: list[DriveItem] = []
        errors: list[dict[str, str]] = []
        for file in files:
            try:
                item = await self.upload_file(db, parent_id, file)
                items.append(item)
            except Exception as exc:  # noqa: BLE001
                errors.append({"file_name": str(file.filename or ""), "error": str(exc)})
        return items, errors

    @staticmethod
    def find_duplicate_in_parent(db: Session, parent_id: int | None, sha256: str, exclude_id: int | None = None) -> DriveItem | None:
        stmt = select(DriveItem).where(
            DriveItem.is_delete.is_(False),
            DriveItem.is_folder.is_(False),
            DriveItem.parent_id == parent_id,
            DriveItem.sha256 == sha256,
        )
        if exclude_id is not None:
            stmt = stmt.where(DriveItem.id != exclude_id)
        return db.scalar(stmt)

    @staticmethod
    def find_file_by_sha256(db: Session, sha256: str) -> DriveItem | None:
        return db.scalar(
            select(DriveItem).where(
                DriveItem.is_delete.is_(False),
                DriveItem.is_folder.is_(False),
                DriveItem.sha256 == sha256,
            )
        )

    async def upload_file(self, db: Session, parent_id: int | None, file: UploadFile) -> DriveItem:
        data = await file.read()
        return self.save_file_bytes(
            db=db,
            parent_id=parent_id,
            file_name=file.filename or "file",
            data=data,
            content_type=file.content_type,
        )

    def save_file_bytes(
        self,
        db: Session,
        parent_id: int | None,
        file_name: str,
        data: bytes,
        content_type: str | None,
    ) -> DriveItem:
        parent = self._resolve_parent(db, parent_id)
        safe_name = self._clean_name(file_name or "file")
        file_name = self._unique_name(db, parent_id, safe_name)

        parent_path = parent.storage_path if parent else ""
        relative_path = self._join_rel(parent_path, file_name)
        disk_path = self._drive_root() / relative_path
        disk_path.parent.mkdir(parents=True, exist_ok=True)

        disk_path.write_bytes(data)

        mime_type = content_type or mimetypes.guess_type(file_name)[0] or "application/octet-stream"
        file_ext = Path(file_name).suffix.lower().lstrip(".")

        item = DriveItem(
            parent_id=parent_id,
            name=file_name,
            is_folder=False,
            storage_path=relative_path,
            file_size=len(data),
            mime_type=mime_type,
            file_ext=file_ext,
            sha256=hashlib.sha256(data).hexdigest(),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def fast_save_existing_file(self, db: Session, source_item_id: int, parent_id: int | None, file_name: str) -> DriveItem:
        source = self.get_item(db, source_item_id)
        if source.is_folder:
            raise ValueError("秒传仅支持文件")

        source_disk = self._drive_root() / source.storage_path
        if not source_disk.exists():
            raise LookupError("源文件不存在")

        parent = self._resolve_parent(db, parent_id)
        safe_name = self._clean_name(file_name)
        target_name = self._unique_name(db, parent_id, safe_name)
        parent_path = parent.storage_path if parent else ""
        target_rel = self._join_rel(parent_path, target_name)
        target_disk = self._drive_root() / target_rel
        target_disk.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_disk, target_disk)

        item = DriveItem(
            parent_id=parent_id,
            name=target_name,
            is_folder=False,
            storage_path=target_rel,
            file_size=source.file_size,
            mime_type=source.mime_type,
            file_ext=source.file_ext,
            sha256=source.sha256,
            is_public=source.is_public,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def move_item(self, db: Session, item_id: int, target_parent_id: int | None) -> DriveItem:
        item = self.get_item(db, item_id)
        target_parent = self._resolve_parent(db, target_parent_id)

        if target_parent is not None and item.is_folder and self._is_inside_path(target_parent.storage_path, item.storage_path):
            raise ValueError("不能移动到自身或子目录")

        target_name = self._unique_name(db, target_parent_id, item.name)
        new_parent_path = target_parent.storage_path if target_parent else ""
        old_rel = item.storage_path
        new_rel = self._join_rel(new_parent_path, target_name)

        old_disk = self._drive_root() / old_rel
        new_disk = self._drive_root() / new_rel
        new_disk.parent.mkdir(parents=True, exist_ok=True)
        if old_disk.exists():
            old_disk.rename(new_disk)

        item.parent_id = target_parent_id
        item.name = target_name
        item.storage_path = new_rel

        if item.is_folder:
            descendants = self._children_recursive(db, old_rel)
            for child in descendants:
                suffix = child.storage_path.removeprefix(f"{old_rel}/")
                child.storage_path = f"{new_rel}/{suffix}"

        db.commit()
        db.refresh(item)
        return item

    def copy_item(self, db: Session, item_id: int, target_parent_id: int | None, new_name: str | None = None) -> DriveItem:
        source = self.get_item(db, item_id)
        target_parent = self._resolve_parent(db, target_parent_id)

        base_name = self._clean_name(new_name) if new_name else source.name
        target_name = self._unique_name(db, target_parent_id, base_name)

        parent_path = target_parent.storage_path if target_parent else ""
        new_rel = self._join_rel(parent_path, target_name)
        src_disk = self._drive_root() / source.storage_path
        dst_disk = self._drive_root() / new_rel
        dst_disk.parent.mkdir(parents=True, exist_ok=True)

        if source.is_folder:
            if src_disk.exists():
                shutil.copytree(src_disk, dst_disk, dirs_exist_ok=True)
            root_clone = DriveItem(
                parent_id=target_parent_id,
                name=target_name,
                is_folder=True,
                storage_path=new_rel,
                is_public=source.is_public,
            )
            db.add(root_clone)
            db.flush()

            mapping: dict[int, int] = {source.id: root_clone.id}
            descendants = db.scalars(
                select(DriveItem)
                .where(
                    DriveItem.is_delete.is_(False),
                    DriveItem.storage_path.like(f"{source.storage_path}/%"),
                )
                .order_by(DriveItem.storage_path.asc())
            ).all()

            descendants.sort(key=lambda item_obj: self._depth(item_obj.storage_path))
            for child in descendants:
                child_suffix = child.storage_path.removeprefix(f"{source.storage_path}/")
                child_rel = f"{new_rel}/{child_suffix}"
                clone = DriveItem(
                    parent_id=mapping.get(child.parent_id),
                    name=child.name,
                    is_folder=child.is_folder,
                    storage_path=child_rel,
                    file_size=child.file_size,
                    mime_type=child.mime_type,
                    file_ext=child.file_ext,
                    sha256=child.sha256,
                    is_public=child.is_public,
                )
                db.add(clone)
                db.flush()
                mapping[child.id] = clone.id

            db.commit()
            db.refresh(root_clone)
            return root_clone

        if src_disk.exists():
            shutil.copy2(src_disk, dst_disk)
        clone = DriveItem(
            parent_id=target_parent_id,
            name=target_name,
            is_folder=False,
            storage_path=new_rel,
            file_size=source.file_size,
            mime_type=source.mime_type,
            file_ext=source.file_ext,
            sha256=source.sha256,
            is_public=source.is_public,
        )
        db.add(clone)
        db.commit()
        db.refresh(clone)
        return clone

    def set_visibility(self, db: Session, item_id: int, is_public: bool) -> DriveItem:
        item = self.get_item(db, item_id)
        item.is_public = is_public
        if item.is_folder:
            descendants = self._children_recursive(db, item.storage_path)
            for child in descendants:
                child.is_public = is_public
        db.commit()
        db.refresh(item)
        return item

    @staticmethod
    def get_item(db: Session, item_id: int) -> DriveItem:
        item = db.scalar(select(DriveItem).where(DriveItem.id == item_id, DriveItem.is_delete.is_(False)))
        if item is None:
            raise LookupError("文件或目录不存在")
        return item

    def rename_item(self, db: Session, item_id: int, name: str) -> DriveItem:
        item = self.get_item(db, item_id)
        safe_name = self._clean_name(name)
        target_name = self._unique_name(db, item.parent_id, safe_name)

        old_rel = item.storage_path
        parent_path = old_rel.rsplit("/", 1)[0] if "/" in old_rel else ""
        new_rel = self._join_rel(parent_path, target_name)

        old_disk = self._drive_root() / old_rel
        new_disk = self._drive_root() / new_rel
        if old_disk.exists():
            old_disk.rename(new_disk)

        item.name = target_name
        item.storage_path = new_rel

        if item.is_folder:
            descendants = db.scalars(
                select(DriveItem).where(
                    DriveItem.is_delete.is_(False),
                    DriveItem.id != item.id,
                    DriveItem.storage_path.like(f"{old_rel}/%"),
                )
            ).all()
            for child in descendants:
                suffix = child.storage_path.removeprefix(f"{old_rel}/")
                child.storage_path = f"{new_rel}/{suffix}"

        db.commit()
        db.refresh(item)
        return item

    def delete_item(self, db: Session, item_id: int) -> None:
        item = self.get_item(db, item_id)

        target_disk = self._drive_root() / item.storage_path
        if item.is_folder:
            if target_disk.exists():
                shutil.rmtree(target_disk, ignore_errors=True)
            descendants = db.scalars(
                select(DriveItem).where(
                    DriveItem.is_delete.is_(False),
                    (DriveItem.id == item.id) | DriveItem.storage_path.like(f"{item.storage_path}/%"),
                )
            ).all()
            for child in descendants:
                child.is_delete = True
        else:
            if target_disk.exists():
                target_disk.unlink()
            item.is_delete = True

        db.commit()

    def batch_delete(self, db: Session, item_ids: list[int]) -> tuple[int, int]:
        success = 0
        for item_id in item_ids:
            try:
                self.delete_item(db, item_id)
                success += 1
            except LookupError:
                continue
        return success, len(item_ids) - success

    def batch_move(self, db: Session, item_ids: list[int], target_parent_id: int | None) -> tuple[int, int]:
        success = 0
        for item_id in item_ids:
            try:
                self.move_item(db, item_id, target_parent_id)
                success += 1
            except (LookupError, ValueError):
                continue
        return success, len(item_ids) - success

    def batch_copy(self, db: Session, item_ids: list[int], target_parent_id: int | None) -> tuple[int, int]:
        success = 0
        for item_id in item_ids:
            try:
                self.copy_item(db, item_id, target_parent_id)
                success += 1
            except (LookupError, ValueError):
                continue
        return success, len(item_ids) - success

    def get_download_file(self, db: Session, item_id: int) -> tuple[DriveItem, Path]:
        item = self.get_item(db, item_id)
        if item.is_folder:
            raise ValueError("目录不支持直接下载")

        target_disk = self._drive_root() / item.storage_path
        if not target_disk.exists():
            raise LookupError("文件不存在")
        return item, target_disk

    def get_preview_file(self, db: Session, item_id: int) -> tuple[DriveItem, Path]:
        item = self.get_item(db, item_id)
        if item.is_folder:
            raise ValueError("目录暂不支持在线预览")
        target_disk = self._drive_root() / item.storage_path
        if not target_disk.exists():
            raise LookupError("文件不存在")
        return item, target_disk

    def get_thumbnail_file(self, db: Session, item_id: int) -> Path:
        item, source_path = self.get_preview_file(db, item_id)
        if not (item.mime_type.startswith("image/") or item.file_ext.lower() in {"png", "jpg", "jpeg", "gif", "webp", "bmp"}):
            raise ValueError("仅图片支持缩略图")

        thumb_path = self._thumbnail_root() / f"{item.id}.webp"
        if thumb_path.exists():
            return thumb_path

        try:
            with PILImage.open(source_path) as source:
                if source.mode not in {"RGB", "RGBA"}:
                    source = source.convert("RGBA" if "A" in source.getbands() else "RGB")
                thumb = ImageOps.fit(source, (320, 320), method=PILImage.Resampling.LANCZOS)
                thumb.save(thumb_path, format="WEBP", quality=85)
        except UnidentifiedImageError as exc:
            raise ValueError("图片解析失败") from exc

        return thumb_path

    def create_batch_download_zip(self, db: Session, item_ids: list[int]) -> tuple[Path, str]:
        root = self._drive_root()
        temp_fd, temp_name = tempfile.mkstemp(prefix="zdrive-batch-", suffix=".zip")
        os.close(temp_fd)
        temp_zip_path = Path(temp_name)

        with zipfile.ZipFile(temp_zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zipf:
            for item_id in item_ids:
                try:
                    item = self.get_item(db, item_id)
                except LookupError:
                    continue

                disk_path = root / item.storage_path
                if not disk_path.exists():
                    continue

                if item.is_folder:
                    for file_path in disk_path.rglob("*"):
                        if file_path.is_file():
                            relative_name = file_path.relative_to(disk_path)
                            zipf.write(file_path, arcname=str(Path(item.name) / relative_name))
                else:
                    zipf.write(disk_path, arcname=item.name)
        return temp_zip_path, "z-drive-batch-download.zip"

    @staticmethod
    def summary(db: Session) -> dict[str, object]:
        active = DriveItem.is_delete.is_(False)
        total_items = db.scalar(select(func.count()).select_from(DriveItem).where(active)) or 0
        total_files = db.scalar(select(func.count()).select_from(DriveItem).where(active, DriveItem.is_folder.is_(False))) or 0
        total_folders = db.scalar(select(func.count()).select_from(DriveItem).where(active, DriveItem.is_folder.is_(True))) or 0
        total_size = db.scalar(select(func.coalesce(func.sum(DriveItem.file_size), 0)).where(active, DriveItem.is_folder.is_(False))) or 0
        recent_uploads = db.scalars(
            select(DriveItem)
            .where(active, DriveItem.is_folder.is_(False))
            .order_by(DriveItem.created_at.desc())
            .limit(10)
        ).all()

        # "近期访问"定义为最近 7 天内的分享访问记录。
        recent_since = func.datetime("now", "-7 day")
        top_visit_rows = db.execute(
            select(
                DriveShare.item_id,
                DriveItem.name,
                func.count(DriveShareAccessLog.id).label("visit_count"),
                func.max(DriveShareAccessLog.created_at).label("last_accessed_at"),
            )
            .join(DriveShare, DriveShare.id == DriveShareAccessLog.share_id)
            .join(DriveItem, DriveItem.id == DriveShare.item_id)
            .where(
                DriveItem.is_delete.is_(False),
                DriveShareAccessLog.created_at >= recent_since,
            )
            .group_by(DriveShare.item_id, DriveItem.name)
            .order_by(func.count(DriveShareAccessLog.id).desc(), func.max(DriveShareAccessLog.created_at).desc())
            .limit(5)
        ).all()

        recent_top_visits: list[dict[str, object]] = []
        for item_id, item_name, visit_count, last_accessed_at in top_visit_rows:
            recent_top_visits.append(
                {
                    "item_id": int(item_id),
                    "item_name": str(item_name),
                    "visit_count": int(visit_count or 0),
                    "last_accessed_at": last_accessed_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(last_accessed_at, "strftime") else None,
                }
            )

        return {
            "total_items": int(total_items),
            "total_files": int(total_files),
            "total_folders": int(total_folders),
            "total_size": int(total_size),
            "recent_uploads": recent_uploads,
            "recent_top_visits": recent_top_visits,
        }

    def summary_with_quota(self, db: Session) -> dict[str, object]:
        base = self.summary(db)
        total_space = max(int(self.settings.cloud_total_space_mb), 0) * 1024 * 1024
        total_size = int(base["total_size"])
        available = max(total_space - total_size, 0)
        return {**base, "total_space": total_space, "available_space": available}

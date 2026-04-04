from __future__ import annotations

import io
import mimetypes
from datetime import date
from pathlib import Path

from PIL import Image as PILImage, ImageOps, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import (
    build_global_sign,
    generate_individual_sign,
    generate_short_code,
    sanitize_filename,
    verify_global_sign,
)
from app.models.image import Image, ImageAccessLog, ImageStats


class ImageBedService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def _storage_dir(self) -> Path:
        return Path(self.settings.storage_path)

    def _original_dir(self) -> Path:
        return self._storage_dir() / "original"

    def _preview_dir(self) -> Path:
        return self._storage_dir() / "preview"

    def ensure_directories(self) -> None:
        self._original_dir().mkdir(parents=True, exist_ok=True)
        self._preview_dir().mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _guess_mime(file_name: str, content_type: str | None) -> str:
        if content_type:
            return content_type
        guessed, _ = mimetypes.guess_type(file_name)
        return guessed or "application/octet-stream"

    def _detect_file_type(self, content_type: str, data: bytes) -> tuple[str, int, int]:
        if content_type.startswith("image/"):
            return self._get_image_dimensions(data)
        if content_type.startswith("video/"):
            return "video", 0, 0
        try:
            return self._get_image_dimensions(data)
        except UnidentifiedImageError:
            return "file", 0, 0

    @staticmethod
    def _get_image_dimensions(data: bytes) -> tuple[str, int, int]:
        with PILImage.open(io.BytesIO(data)) as image:
            return "image", image.width, image.height

    @staticmethod
    def _generate_unique_short_code(db: Session) -> str:
        while True:
            short_code = generate_short_code()
            exists = db.scalar(select(Image.id).where(Image.short_code == short_code, Image.is_delete.is_(False)))
            if exists is None:
                return short_code

    def _build_paths(self, short_code: str, original_name: str) -> tuple[Path, Path]:
        safe_name = sanitize_filename(original_name) or "file"
        storage_name = f"{short_code}_{safe_name}"
        original_path = self._original_dir() / storage_name
        preview_path = self._preview_dir() / f"{short_code}.webp"
        return original_path, preview_path

    @staticmethod
    def _create_preview_image(data: bytes, preview_path: Path) -> bool:
        try:
            with PILImage.open(io.BytesIO(data)) as source:
                if source.mode not in {"RGB", "RGBA"}:
                    source = source.convert("RGBA" if "A" in source.getbands() else "RGB")
                preview = ImageOps.contain(source.copy(), (1600, 1600))
                preview.save(preview_path, format="WEBP", quality=82)
                return True
        except UnidentifiedImageError:
            return False

    @staticmethod
    def _build_url(base_url: str, path: str, sign: str | None = None) -> str:
        url = f"{base_url.rstrip('/')}/{path.lstrip('/')}"
        if sign:
            separator = "&" if "?" in url else "?"
            url = f"{url}{separator}sign={sign}"
        return url

    @staticmethod
    def _get_public_extension(image: Image) -> str:
        suffix = Path(image.file_name or "").suffix.lower().lstrip(".")
        if suffix:
            return suffix
        guessed = mimetypes.guess_extension(image.mime_type or "", strict=False) or ""
        guessed = guessed.lstrip(".").lower()
        if guessed:
            return guessed
        return "bin"

    def build_public_paths(self, image: Image) -> dict[str, str]:
        ext = self._get_public_extension(image)
        return {
            "view_path": f"i/{image.short_code}.{ext}",
            "direct_path": f"gallery/file/{image.short_code}.{ext}",
            "preview_path": f"gallery/preview/{image.short_code}.{ext}",
            "download_path": f"gallery/download/{image.short_code}.{ext}",
        }

    def build_public_urls(self, image: Image, base_url: str, sign: str) -> dict[str, str]:
        paths = self.build_public_paths(image)
        return {
            "view_url": self._build_url(base_url, paths["view_path"], sign),
            "direct_url": self._build_url(base_url, paths["direct_path"], sign),
            "preview_url": self._build_url(base_url, paths["preview_path"], sign),
            "download_url": self._build_url(base_url, paths["download_path"], sign),
        }

    def _build_sign(self, image: Image) -> str:
        if image.access_mode == "individual":
            return image.sign
        if self.settings.image_auth_mode == "sign":
            return build_global_sign(self.settings.sign_salt, image.storage_name)
        return ""

    async def upload_file(self, db: Session, file, access_mode: str) -> tuple[Image, str]:
        self.ensure_directories()
        if access_mode not in {"none", "individual"}:
            raise ValueError("access_mode 只能是 none 或 individual")

        data = await file.read()
        if len(data) > self.settings.image_max_file_size_mb * 1024 * 1024:
            raise ValueError(f"文件大小超过限制: {self.settings.image_max_file_size_mb}MB")

        mime_type = self._guess_mime(file.filename, file.content_type)
        file_type, width, height = self._detect_file_type(mime_type, data)

        short_code = self._generate_unique_short_code(db)
        original_path, preview_path = self._build_paths(short_code, file.filename)
        storage_name = original_path.name

        original_path.write_bytes(data)

        has_compressed = False
        if file_type == "image":
            has_compressed = self._create_preview_image(data, preview_path)

        image = Image(
            short_code=short_code,
            file_name=file.filename,
            storage_name=storage_name,
            file_path=str(original_path),
            file_size=len(data),
            file_type=file_type,
            mime_type=mime_type,
            width=width,
            height=height,
            access_mode=access_mode,
            sign=generate_individual_sign() if access_mode == "individual" else "",
            has_thumbnail=has_compressed,
            has_compressed=has_compressed,
        )
        db.add(image)
        db.commit()
        db.refresh(image)

        return image, self._build_sign(image)

    @staticmethod
    def get_image_by_shortcode(db: Session, short_code: str) -> Image:
        image = db.scalar(select(Image).where(Image.short_code == short_code, Image.is_delete.is_(False)))
        if image is None:
            raise LookupError("图片不存在")
        return image

    def _check_access(self, image: Image, sign: str) -> None:
        if image.access_mode == "individual":
            if image.sign != sign:
                raise PermissionError("访问密码错误")
            return
        if self.settings.image_auth_mode == "sign" and not verify_global_sign(self.settings.sign_salt, image.storage_name, sign):
            raise PermissionError("访问密码错误")

    def get_image(self, db: Session, short_code: str, sign: str) -> Image:
        image = self.get_image_by_shortcode(db, short_code)
        self._check_access(image, sign)
        return image

    @staticmethod
    def _read_bytes(file_path: str) -> bytes:
        return Path(file_path).read_bytes()

    def get_original_image_data(self, image: Image) -> bytes:
        return self._read_bytes(image.file_path)

    def get_compressed_view(self, image: Image) -> tuple[bytes, str]:
        if image.file_type != "image":
            return self.get_original_image_data(image), image.mime_type
        preview_path = self._preview_dir() / f"{image.short_code}.webp"
        if image.has_compressed and preview_path.exists():
            return preview_path.read_bytes(), "image/webp"
        return self.get_original_image_data(image), image.mime_type

    @staticmethod
    def record_access(db: Session, image: Image, access_type: str, ip: str, user_agent: str, referer: str) -> None:
        log = ImageAccessLog(
            image_id=image.id,
            short_code=image.short_code,
            access_ip=ip,
            user_agent=user_agent,
            referer=referer,
            access_type=access_type,
        )
        db.add(log)

        today = date.today().isoformat()
        stat = db.scalar(select(ImageStats).where(ImageStats.image_id == image.id, ImageStats.stat_date == today))
        if stat is None:
            stat = ImageStats(image_id=image.id, short_code=image.short_code, stat_date=today)
            db.add(stat)

        stat.view_count = stat.view_count or 0
        stat.download_count = stat.download_count or 0
        image.view_count = image.view_count or 0
        image.download_count = image.download_count or 0

        if access_type in {"view", "preview"}:
            image.view_count += 1
            stat.view_count += 1
        elif access_type == "download":
            image.download_count += 1
            stat.download_count += 1

        db.commit()

    def delete_image(self, db: Session, short_code: str) -> None:
        image = self.get_image_by_shortcode(db, short_code)
        image.is_delete = True
        db.commit()

    def update_image_access_mode(self, db: Session, short_code: str, access_mode: str, custom_sign: str = "") -> Image:
        if access_mode not in {"none", "individual"}:
            raise ValueError("access_mode 必须是 none 或 individual")
        image = self.get_image_by_shortcode(db, short_code)
        image.access_mode = access_mode
        image.sign = custom_sign if access_mode == "individual" and custom_sign else (generate_individual_sign() if access_mode == "individual" else "")
        db.commit()
        db.refresh(image)
        return image

    def build_upload_payload(self, image: Image, base_url: str, sign: str) -> dict:
        public_urls = self.build_public_urls(image, base_url, sign)
        payload = {
            "short_code": image.short_code,
            "file_name": image.file_name,
            "file_size": image.file_size,
            "file_type": image.file_type,
            "width": image.width,
            "height": image.height,
            "view_url": public_urls["view_url"],
            "direct_url": public_urls["direct_url"],
            "preview_url": public_urls["preview_url"],
            "download_url": public_urls["download_url"],
            "sign": sign or None,
        }
        return payload

    def list_images(self, db: Session, page: int, page_size: int, file_type: str, query: str) -> dict:
        page = max(page, 1)
        page_size = max(min(page_size, 200), 1)
        image_cols = Image.__table__.c
        filters = [image_cols.is_delete.is_(False)]
        if file_type and file_type != "all":
            filters.append(image_cols.file_type == file_type)
        if query:
            keyword = f"%{query}%"
            filters.append((image_cols.file_name.like(keyword)) | (image_cols.short_code.like(keyword)))

        total = db.scalar(select(func.count()).select_from(Image).where(*filters)) or 0
        rows = db.scalars(
            select(Image)
            .where(*filters)
            .order_by(Image.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()

        items = []
        for image in rows:
            sign = self._build_sign(image)
            public_urls = self.build_public_urls(image, self.settings.base_url, sign)
            item = {
                "id": image.id,
                "short_code": image.short_code,
                "file_name": image.file_name,
                "file_size": image.file_size,
                "file_type": image.file_type,
                "mime_type": image.mime_type,
                "width": image.width,
                "height": image.height,
                "view_count": image.view_count,
                "download_count": image.download_count,
                "view_url": public_urls["view_url"],
                "direct_url": public_urls["direct_url"],
                "preview_url": public_urls["preview_url"],
                "download_url": public_urls["download_url"],
                "access_mode": image.access_mode,
                "sign": sign or None,
                "created_at": image.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            }
            items.append(item)

        return {"total": int(total), "page": page, "items": items}

    @staticmethod
    def get_stats(db: Session) -> dict:
        total_images = db.scalar(select(func.count()).select_from(Image).where(Image.is_delete.is_(False))) or 0
        total_size = db.scalar(select(func.coalesce(func.sum(Image.file_size), 0)).where(Image.is_delete.is_(False))) or 0
        total_views = db.scalar(select(func.coalesce(func.sum(Image.view_count), 0)).where(Image.is_delete.is_(False))) or 0
        total_downloads = db.scalar(select(func.coalesce(func.sum(Image.download_count), 0)).where(Image.is_delete.is_(False))) or 0

        today = date.today().isoformat()
        today_views = db.scalar(select(func.coalesce(func.sum(ImageStats.view_count), 0)).where(ImageStats.stat_date == today)) or 0
        today_uploads = db.scalar(select(func.count()).select_from(Image).where(func.date(Image.created_at) == today, Image.is_delete.is_(False))) or 0

        top_image_rows = db.scalars(select(Image).where(Image.is_delete.is_(False)).order_by(Image.view_count.desc()).limit(5)).all()
        top_images = [
            {
                "short_code": image.short_code,
                "file_name": image.file_name,
                "file_type": image.file_type,
                "view_count": image.view_count,
            }
            for image in top_image_rows
        ]

        referer_rows = db.execute(
            select(ImageAccessLog.referer, func.count()).group_by(ImageAccessLog.referer).order_by(func.count().desc()).limit(5)
        ).all()
        top_refers = [{"referer": row[0] or "", "count": int(row[1])} for row in referer_rows]

        origin_rows = db.execute(
            select(ImageAccessLog.access_ip, func.count()).group_by(ImageAccessLog.access_ip).order_by(func.count().desc()).limit(5)
        ).all()
        top_origins = [{"origin_ip": row[0] or "", "count": int(row[1])} for row in origin_rows]

        daily_rows = db.execute(
            select(ImageStats.stat_date, func.coalesce(func.sum(ImageStats.view_count), 0), func.coalesce(func.sum(ImageStats.download_count), 0))
            .group_by(ImageStats.stat_date)
            .order_by(ImageStats.stat_date.desc())
            .limit(14)
        ).all()
        daily_stats = [{"date": row[0], "views": int(row[1]), "downloads": int(row[2]), "uploads": 0} for row in daily_rows]

        return {
            "total_images": int(total_images),
            "total_size": int(total_size),
            "total_views": int(total_views),
            "total_downloads": int(total_downloads),
            "today_views": int(today_views),
            "today_uploads": int(today_uploads),
            "top_images": top_images,
            "top_refers": top_refers,
            "top_origins": top_origins,
            "daily_stats": daily_stats,
        }
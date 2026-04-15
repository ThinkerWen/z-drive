from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

from app.core.date import utc_now_naive


class DriveChunkUploadService:
    def __init__(self, storage_root: str) -> None:
        self.storage_root = Path(storage_root)

    def _upload_root(self) -> Path:
        return self.storage_root / "cloud" / ".uploads"

    def ensure_directories(self) -> None:
        self._upload_root().mkdir(parents=True, exist_ok=True)

    def _upload_dir(self, upload_id: str) -> Path:
        return self._upload_root() / upload_id

    def _meta_path(self, upload_id: str) -> Path:
        return self._upload_dir(upload_id) / "meta.json"

    def _chunk_path(self, upload_id: str, index: int) -> Path:
        return self._upload_dir(upload_id) / f"chunk_{index:08d}.part"

    def init_upload(self, parent_id: int | None, file_name: str, total_chunks: int, mime_type: str) -> dict:
        upload_id = uuid.uuid4().hex
        upload_dir = self._upload_dir(upload_id)
        upload_dir.mkdir(parents=True, exist_ok=True)

        meta = {
            "upload_id": upload_id,
            "parent_id": parent_id,
            "file_name": file_name,
            "total_chunks": total_chunks,
            "mime_type": mime_type,
            "paused": False,
            "uploaded_bytes": 0,
            "created_at": utc_now_naive().isoformat(),
            "updated_at": utc_now_naive().isoformat(),
        }
        self._meta_path(upload_id).write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")
        return meta

    def _save_meta(self, upload_id: str, meta: dict) -> None:
        meta["updated_at"] = utc_now_naive().isoformat()
        self._meta_path(upload_id).write_text(json.dumps(meta, ensure_ascii=True), encoding="utf-8")

    def get_meta(self, upload_id: str) -> dict:
        meta_path = self._meta_path(upload_id)
        if not meta_path.exists():
            raise LookupError("上传任务不存在")
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def save_chunk(self, upload_id: str, index: int, data: bytes) -> None:
        upload_dir = self._upload_dir(upload_id)
        if not upload_dir.exists():
            raise LookupError("上传任务不存在")
        meta = self.get_meta(upload_id)
        if meta.get("paused"):
            raise ValueError("上传任务已暂停")
        self._chunk_path(upload_id, index).write_bytes(data)
        meta["uploaded_bytes"] = int(meta.get("uploaded_bytes", 0)) + len(data)
        self._save_meta(upload_id, meta)

    def uploaded_chunks(self, upload_id: str) -> list[int]:
        upload_dir = self._upload_dir(upload_id)
        if not upload_dir.exists():
            raise LookupError("上传任务不存在")

        indexes: list[int] = []
        for part_file in upload_dir.glob("chunk_*.part"):
            try:
                indexes.append(int(part_file.stem.removeprefix("chunk_")))
            except ValueError:
                continue
        return sorted(indexes)

    def merge_chunks(self, upload_id: str) -> tuple[dict, bytes]:
        meta = self.get_meta(upload_id)
        total_chunks = int(meta["total_chunks"])

        data_parts: list[bytes] = []
        for index in range(total_chunks):
            chunk_path = self._chunk_path(upload_id, index)
            if not chunk_path.exists():
                raise ValueError(f"缺少分片 {index}")
            data_parts.append(chunk_path.read_bytes())
        return meta, b"".join(data_parts)

    def cancel_upload(self, upload_id: str) -> None:
        upload_dir = self._upload_dir(upload_id)
        if upload_dir.exists():
            shutil.rmtree(upload_dir, ignore_errors=True)

    def set_paused(self, upload_id: str, paused: bool) -> dict:
        meta = self.get_meta(upload_id)
        meta["paused"] = paused
        self._save_meta(upload_id, meta)
        return meta

    def list_tasks(self) -> list[dict]:
        tasks: list[dict] = []
        root = self._upload_root()
        if not root.exists():
            return tasks
        for sub_dir in root.iterdir():
            if not sub_dir.is_dir():
                continue
            meta_path = sub_dir / "meta.json"
            if not meta_path.exists():
                continue
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                continue
            tasks.append(meta)
        return tasks

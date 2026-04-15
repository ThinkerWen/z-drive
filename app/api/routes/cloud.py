from __future__ import annotations

from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import build_admin_auth_dependency
from app.core.urls import get_external_base_url
from app.db.session import get_db
from app.models.cloud_item import DriveItem
from app.schemas.cloud import (
    DriveBatchCopyRequest,
    DriveBatchDeleteRequest,
    DriveBatchMoveRequest,
    DriveBatchResultResponse,
    DriveChunkCompleteResponse,
    DriveChunkInitRequest,
    DriveChunkInitResponse,
    DriveChunkStatusResponse,
    DriveChunkTaskResponse,
    DriveCopyRequest,
    DriveCreateFolderRequest,
    DriveCreateShareRequest,
    DriveFastUploadCheckRequest,
    DriveFastUploadCheckResponse,
    DriveFastUploadSaveRequest,
    DriveItemResponse,
    DriveListResponse,
    DriveMoveRequest,
    DriveRenameRequest,
    DriveShareAccessLogResponse,
    DriveShareAccessRequest,
    DriveShareAccessResponse,
    DriveShareResponse,
    DriveSummaryResponse,
    DriveTopVisitResponse,
    DriveUploadMultipleResponse,
    DriveVisibilityRequest,
)
from app.services.cloud_chunk_upload import DriveChunkUploadService
from app.services.cloud_share import DriveShareService
from app.services.cloud import DriveService

router = APIRouter(prefix="/cloud", tags=["cloud"])
settings = get_settings()
service = DriveService(settings)
share_service = DriveShareService()
chunk_service = DriveChunkUploadService(settings.storage_path)
admin_auth = build_admin_auth_dependency(settings.jwt_secret, settings.admin_token)


def _base_url(request: Request) -> str:
    return get_external_base_url(request)


def _inline_content_disposition(file_name: str) -> str:
    encoded_name = quote(file_name, safe="")
    return f"inline; filename*=UTF-8''{encoded_name}"


def _to_item_payload(item, duplicate_of_id: int | None = None) -> DriveItemResponse:
    return DriveItemResponse(
        id=int(item.id),
        parent_id=int(item.parent_id) if item.parent_id is not None else None,
        name=str(item.name),
        is_folder=bool(item.is_folder),
        file_size=int(item.file_size),
        mime_type=str(item.mime_type or ""),
        file_ext=str(item.file_ext or ""),
        is_public=bool(item.is_public),
        duplicate_of_id=duplicate_of_id,
        created_at=item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=item.updated_at.strftime("%Y-%m-%d %H:%M:%S"),
    )


def _to_share_payload(share, base_url: str, item_name: str = "") -> DriveShareResponse:
    return DriveShareResponse(
        id=int(share.id),
        item_id=int(share.item_id),
        item_name=item_name,
        share_code=str(share.share_code),
        has_password=bool(share.password_hash),
        is_active=bool(share.is_active),
        expires_at=share.expires_at.strftime("%Y-%m-%d %H:%M:%S") if share.expires_at else None,
        created_at=share.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        share_url=f"{base_url}/f/{share.share_code}",
    )


@router.get("/items", response_model=DriveListResponse)
async def list_items(
    parent_id: int | None = Query(default=None),
    query: str = "",
    sort_by: str = Query(default="name", pattern="^(name|time|size)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    file_type: str = "all",
    created_from: str = "",
    created_to: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveListResponse:
    items = service.list_items(db, parent_id, query, sort_by, order, file_type, created_from, created_to)
    return DriveListResponse(parent_id=parent_id, items=[_to_item_payload(item) for item in items])


@router.post("/folders", response_model=DriveItemResponse)
async def create_folder(
    payload: DriveCreateFolderRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.create_folder(db, payload.parent_id, payload.name)
        return _to_item_payload(item)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/upload", response_model=DriveItemResponse)
async def upload_file(
    parent_id: int | None = Query(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = await service.upload_file(db, parent_id, file)
        duplicate = service.find_duplicate_in_parent(db, parent_id, item.sha256, exclude_id=item.id)
        return _to_item_payload(item, duplicate_of_id=(int(duplicate.id) if duplicate else None))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/upload/multiple", response_model=DriveUploadMultipleResponse)
async def upload_multiple_files(
    parent_id: int | None = Query(default=None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveUploadMultipleResponse:
    items, errors = await service.upload_files(db, parent_id, files)
    enriched_items: list[DriveItemResponse] = []
    for item in items:
        duplicate = service.find_duplicate_in_parent(db, parent_id, item.sha256, exclude_id=item.id)
        enriched_items.append(_to_item_payload(item, duplicate_of_id=(int(duplicate.id) if duplicate else None)))
    return DriveUploadMultipleResponse(
        total=len(files),
        success=len(items),
        failed=len(errors),
        items=enriched_items,
        errors=errors,
    )


@router.post("/uploads/fast-check", response_model=DriveFastUploadCheckResponse)
async def fast_upload_check(
    payload: DriveFastUploadCheckRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveFastUploadCheckResponse:
    source = service.find_duplicate_in_parent(db, payload.parent_id, payload.sha256)
    if source is None:
        source = service.find_file_by_sha256(db, payload.sha256)

    if source is None:
        return DriveFastUploadCheckResponse(exists=False, source_item_id=None, message="未命中秒传")
    return DriveFastUploadCheckResponse(exists=True, source_item_id=int(source.id), message="命中秒传")


@router.post("/uploads/fast-save", response_model=DriveItemResponse)
async def fast_upload_save(
    payload: DriveFastUploadSaveRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.fast_save_existing_file(db, payload.source_item_id, payload.parent_id, payload.file_name)
        duplicate = service.find_duplicate_in_parent(db, payload.parent_id, item.sha256, exclude_id=item.id)
        return _to_item_payload(item, duplicate_of_id=(int(duplicate.id) if duplicate else None))
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/shares", response_model=DriveShareResponse)
async def create_share(
    request: Request,
    payload: DriveCreateShareRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveShareResponse:
    try:
        share = share_service.create_share(db, payload.item_id, payload.password, payload.expires_minutes)
        return _to_share_payload(share, _base_url(request))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/shares", response_model=list[DriveShareResponse])
async def list_shares(request: Request, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> list[DriveShareResponse]:
    shares = share_service.list_shares(db)
    base_url = _base_url(request)
    item_ids = {int(share.item_id) for share in shares}
    names = {
        int(item.id): str(item.name)
        for item in db.scalars(select(DriveItem).where(DriveItem.id.in_(item_ids), DriveItem.is_delete.is_(False))).all()
    }
    return [_to_share_payload(share, base_url, names.get(int(share.item_id), "")) for share in shares]


@router.delete("/shares/{share_id}")
async def cancel_share(share_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        share_service.cancel_share(db, share_id)
        return {"message": "分享已取消"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/shares/{share_id}/logs", response_model=list[DriveShareAccessLogResponse])
async def list_share_logs(
    share_id: int,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> list[DriveShareAccessLogResponse]:
    logs = share_service.list_share_logs(db, share_id)
    return [
        DriveShareAccessLogResponse(
            id=int(log.id),
            share_id=int(log.share_id),
            access_ip=str(log.access_ip),
            user_agent=str(log.user_agent),
            referer=str(log.referer),
            created_at=log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        )
        for log in logs
    ]


@router.post("/public/{share_code}/access", response_model=DriveShareAccessResponse)
async def access_shared_item(
    request: Request,
    share_code: str,
    payload: DriveShareAccessRequest,
    db: Session = Depends(get_db),
) -> DriveShareAccessResponse:
    try:
        share, item = share_service.resolve_share(db, share_code, payload.password)
        share_service.record_access(db, share, request)
        password_query = f"?password={payload.password}" if payload.password else ""
        return DriveShareAccessResponse(
            share_code=share_code,
            item=_to_item_payload(item),
            preview_url=f"{_base_url(request)}/api/cloud/public/{share_code}/preview{password_query}",
            download_url=f"{_base_url(request)}/api/cloud/public/{share_code}/download{password_query}",
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/public/{share_code}/preview")
async def preview_shared_item(share_code: str, password: str = "", db: Session = Depends(get_db)) -> FileResponse:
    try:
        _, item = share_service.resolve_share(db, share_code, password)
        if item.is_folder:
            raise ValueError("目录暂不支持在线预览")
        file_path = Path(settings.storage_path) / "cloud" / item.storage_path
        if not file_path.exists():
            raise LookupError("文件不存在")
        headers = {"Content-Disposition": _inline_content_disposition(str(item.name))}
        return FileResponse(path=file_path, media_type=item.mime_type or "application/octet-stream", headers=headers)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/public/{share_code}/download")
async def download_shared_item(share_code: str, password: str = "", db: Session = Depends(get_db)) -> FileResponse:
    try:
        _, item = share_service.resolve_share(db, share_code, password)
        if item.is_folder:
            raise ValueError("目录暂不支持直接下载")
        file_path = Path(settings.storage_path) / "cloud" / item.storage_path
        if not file_path.exists():
            raise LookupError("文件不存在")
        return FileResponse(path=file_path, media_type=item.mime_type or "application/octet-stream", filename=item.name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/items/batch/delete", response_model=DriveBatchResultResponse)
async def batch_delete_items(
    payload: DriveBatchDeleteRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveBatchResultResponse:
    success, failed = service.batch_delete(db, payload.item_ids)
    return DriveBatchResultResponse(
        total=len(payload.item_ids),
        success=success,
        failed=failed,
        message="批量删除完成",
    )


@router.post("/items/batch/move", response_model=DriveBatchResultResponse)
async def batch_move_items(
    payload: DriveBatchMoveRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveBatchResultResponse:
    success, failed = service.batch_move(db, payload.item_ids, payload.target_parent_id)
    return DriveBatchResultResponse(
        total=len(payload.item_ids),
        success=success,
        failed=failed,
        message="批量移动完成",
    )


@router.post("/items/batch/copy", response_model=DriveBatchResultResponse)
async def batch_copy_items(
    payload: DriveBatchCopyRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveBatchResultResponse:
    success, failed = service.batch_copy(db, payload.item_ids, payload.target_parent_id)
    return DriveBatchResultResponse(
        total=len(payload.item_ids),
        success=success,
        failed=failed,
        message="批量复制完成",
    )


@router.get("/download/{item_id}")
async def download_file(item_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> FileResponse:
    try:
        item, file_path = service.get_download_file(db, item_id)
        return FileResponse(path=file_path, media_type=item.mime_type or "application/octet-stream", filename=item.name)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/preview/{item_id}")
async def preview_file(item_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> FileResponse:
    try:
        item, file_path = service.get_preview_file(db, item_id)
        headers = {"Content-Disposition": _inline_content_disposition(str(item.name))}
        return FileResponse(path=file_path, media_type=item.mime_type or "application/octet-stream", headers=headers)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/thumbnail/{item_id}")
async def thumbnail_file(item_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> FileResponse:
    try:
        thumb_path = service.get_thumbnail_file(db, item_id)
        return FileResponse(path=thumb_path, media_type="image/webp")
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/items/batch/download")
async def batch_download_items(
    payload: DriveBatchDeleteRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> FileResponse:
    zip_path, file_name = service.create_batch_download_zip(db, payload.item_ids)

    def _cleanup(path: Path) -> None:
        if path.exists():
            path.unlink()

    background_tasks.add_task(_cleanup, zip_path)
    return FileResponse(path=zip_path, media_type="application/zip", filename=file_name)


@router.patch("/items/{item_id}", response_model=DriveItemResponse)
async def rename_item(
    item_id: int,
    payload: DriveRenameRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.rename_item(db, item_id, payload.name)
        return _to_item_payload(item)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/items/{item_id}/move", response_model=DriveItemResponse)
async def move_item(
    item_id: int,
    payload: DriveMoveRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.move_item(db, item_id, payload.target_parent_id)
        return _to_item_payload(item)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/items/{item_id}/copy", response_model=DriveItemResponse)
async def copy_item(
    item_id: int,
    payload: DriveCopyRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.copy_item(db, item_id, payload.target_parent_id, payload.name)
        return _to_item_payload(item)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/items/{item_id}/visibility", response_model=DriveItemResponse)
async def set_visibility(
    item_id: int,
    payload: DriveVisibilityRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveItemResponse:
    try:
        item = service.set_visibility(db, item_id, payload.is_public)
        return _to_item_payload(item)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        service.delete_item(db, item_id)
        return {"message": "删除成功"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/uploads/chunk/init", response_model=DriveChunkInitResponse)
async def init_chunk_upload(
    payload: DriveChunkInitRequest,
    _: str = Depends(admin_auth),
) -> DriveChunkInitResponse:
    chunk_service.ensure_directories()
    meta = chunk_service.init_upload(payload.parent_id, payload.file_name, payload.total_chunks, payload.mime_type)
    return DriveChunkInitResponse(upload_id=meta["upload_id"], total_chunks=int(meta["total_chunks"]), uploaded_chunks=[])


@router.put("/uploads/chunk/{upload_id}/{index}")
async def upload_chunk(
    upload_id: str,
    index: int,
    chunk: UploadFile = File(...),
    _: str = Depends(admin_auth),
) -> dict[str, str]:
    try:
        data = await chunk.read()
        chunk_service.save_chunk(upload_id, index, data)
        return {"message": "分片上传成功"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/uploads/chunk/{upload_id}", response_model=DriveChunkStatusResponse)
async def chunk_status(upload_id: str, _: str = Depends(admin_auth)) -> DriveChunkStatusResponse:
    try:
        meta = chunk_service.get_meta(upload_id)
        uploaded = chunk_service.uploaded_chunks(upload_id)
        created_at = datetime.fromisoformat(str(meta.get("created_at") or datetime.now().isoformat()))
        elapsed = max((datetime.now() - created_at).total_seconds(), 1.0)
        uploaded_bytes = int(meta.get("uploaded_bytes", 0))
        avg_speed = int(uploaded_bytes / elapsed)
        return DriveChunkStatusResponse(
            upload_id=upload_id,
            total_chunks=int(meta["total_chunks"]),
            uploaded_chunks=uploaded,
            uploaded_bytes=uploaded_bytes,
            average_speed_bytes=avg_speed,
            paused=bool(meta.get("paused", False)),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/uploads/tasks", response_model=list[DriveChunkTaskResponse])
async def list_upload_tasks(_: str = Depends(admin_auth)) -> list[DriveChunkTaskResponse]:
    tasks = chunk_service.list_tasks()
    result: list[DriveChunkTaskResponse] = []
    for meta in tasks:
        upload_id = str(meta.get("upload_id", ""))
        if not upload_id:
            continue
        try:
            uploaded = chunk_service.uploaded_chunks(upload_id)
        except LookupError:
            continue
        result.append(
            DriveChunkTaskResponse(
                upload_id=upload_id,
                file_name=str(meta.get("file_name", "")),
                total_chunks=int(meta.get("total_chunks", 0)),
                uploaded_chunks=uploaded,
                uploaded_bytes=int(meta.get("uploaded_bytes", 0)),
                paused=bool(meta.get("paused", False)),
            )
        )
    return result


@router.post("/uploads/chunk/{upload_id}/pause")
async def pause_chunk_upload(upload_id: str, _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        chunk_service.set_paused(upload_id, True)
        return {"message": "上传任务已暂停"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/uploads/chunk/{upload_id}/resume")
async def resume_chunk_upload(upload_id: str, _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        chunk_service.set_paused(upload_id, False)
        return {"message": "上传任务已恢复"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/uploads/chunk/{upload_id}/complete", response_model=DriveChunkCompleteResponse)
async def complete_chunk_upload(
    upload_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> DriveChunkCompleteResponse:
    try:
        meta, file_bytes = chunk_service.merge_chunks(upload_id)
        item = service.save_file_bytes(
            db=db,
            parent_id=meta.get("parent_id"),
            file_name=str(meta.get("file_name") or "file"),
            data=file_bytes,
            content_type=str(meta.get("mime_type") or "application/octet-stream"),
        )
        chunk_service.cancel_upload(upload_id)
        return DriveChunkCompleteResponse(upload_id=upload_id, item=_to_item_payload(item))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/uploads/chunk/{upload_id}/cancel")
async def cancel_chunk_upload(upload_id: str, _: str = Depends(admin_auth)) -> dict[str, str]:
    chunk_service.cancel_upload(upload_id)
    return {"message": "上传任务已取消"}


@router.get("/summary", response_model=DriveSummaryResponse)
async def summary(db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> DriveSummaryResponse:
    payload = service.summary_with_quota(db)
    top_visits = []
    for row in payload.get("recent_top_visits", []):
        top_visits.append(
            DriveTopVisitResponse(
                item_id=int(row.get("item_id", 0)) if isinstance(row, dict) else 0,
                item_name=str(row.get("item_name", "")) if isinstance(row, dict) else "",
                visit_count=int(row.get("visit_count", 0)) if isinstance(row, dict) else 0,
                last_accessed_at=str(row.get("last_accessed_at")) if isinstance(row, dict) and row.get("last_accessed_at") else None,
            )
        )

    return DriveSummaryResponse(
        total_items=int(payload["total_items"]),
        total_files=int(payload["total_files"]),
        total_folders=int(payload["total_folders"]),
        total_size=int(payload["total_size"]),
        total_space=int(payload["total_space"]),
        available_space=int(payload["available_space"]),
        recent_uploads=[_to_item_payload(item) for item in payload["recent_uploads"]],
        recent_top_visits=top_visits,
    )

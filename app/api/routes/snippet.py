from __future__ import annotations

from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.date import format_app_datetime
from app.core.security import build_admin_auth_dependency
from app.core.urls import get_external_base_url
from app.db.session import get_db
from app.models.snippet import Snippet, SnippetFolder
from app.schemas.snippet import (
    SnippetFolderCreateRequest,
    SnippetFolderResponse,
    SnippetListResponse,
    SnippetPublicAccessRequest,
    SnippetPublicAccessResponse,
    SnippetResponse,
    SnippetShareCreateRequest,
    SnippetShareResponse,
    SnippetTagCreateRequest,
    SnippetTagResponse,
    SnippetUpsertRequest,
)
from app.services.snippet import SnippetService

router = APIRouter(prefix="/snippets", tags=["snippets"])
settings = get_settings()
service = SnippetService()
admin_auth = build_admin_auth_dependency(settings.jwt_secret, settings.admin_token)


def _base_url(request: Request) -> str:
    return get_external_base_url(request)


def _dt(value) -> str | None:
    return format_app_datetime(value)


def _snippet_to_payload(db: Session, snippet: Snippet) -> SnippetResponse:
    code_content = service.read_snippet_content(snippet)
    detected, highlighted_html = service.render_highlighted_html(code_content, snippet.language)
    if not highlighted_html.strip():
        highlighted_html = service.escape_plain_preview(code_content)

    folder_name = None
    if snippet.folder_id is not None:
        folder = db.get(SnippetFolder, snippet.folder_id)
        folder_name = folder.name if folder is not None else None

    tags_map = service._snippet_tags_map(db, [int(snippet.id)])
    tags = tags_map.get(int(snippet.id), [])

    return SnippetResponse(
        id=int(snippet.id),
        title=str(snippet.title),
        description=str(snippet.description or ""),
        language=str(snippet.language or "auto"),
        detected_language=str(snippet.detected_language or detected),
        effective_language=str((snippet.language or "auto") if (snippet.language or "auto") != "auto" else (snippet.detected_language or detected)),
        code_content=code_content,
        highlighted_html=highlighted_html,
        line_count=max(len(code_content.splitlines()), 1),
        folder_id=int(snippet.folder_id) if snippet.folder_id is not None else None,
        folder_name=folder_name,
        tags=tags,
        is_public=bool(snippet.is_public),
        created_at=_dt(snippet.created_at) or "",
        updated_at=_dt(snippet.updated_at) or "",
    )


def _share_payload(request: Request, share, snippet: Snippet) -> SnippetShareResponse:
    return SnippetShareResponse(
        id=int(share.id),
        snippet_id=int(snippet.id),
        snippet_title=str(snippet.title),
        share_code=str(share.share_code),
        share_url=f"{_base_url(request)}/p/{share.share_code}",
        has_password=bool(share.password_hash),
        expires_at=_dt(share.expires_at),
        max_access_count=int(share.max_access_count) if share.max_access_count is not None else None,
        access_count=int(share.access_count),
        is_one_time=bool(share.is_one_time),
        is_active=bool(share.is_active),
        created_at=_dt(share.created_at) or "",
        last_accessed_at=_dt(share.last_accessed_at),
    )


@router.post("/folders", response_model=SnippetFolderResponse)
async def create_folder(
    payload: SnippetFolderCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetFolderResponse:
    try:
        folder = service.create_folder(db, payload.name, payload.description)
        return SnippetFolderResponse(id=int(folder.id), name=str(folder.name), description=str(folder.description or ""))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/folders", response_model=list[SnippetFolderResponse])
async def list_folders(db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> list[SnippetFolderResponse]:
    folders = service.list_folders(db)
    return [SnippetFolderResponse(id=int(item.id), name=str(item.name), description=str(item.description or "")) for item in folders]


@router.post("/tags", response_model=SnippetTagResponse)
async def create_tag(
    payload: SnippetTagCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetTagResponse:
    tags = service._upsert_tags(db, [payload.name])
    db.commit()
    tag = tags[0]
    return SnippetTagResponse(id=int(tag.id), name=str(tag.name))


@router.get("/tags", response_model=list[SnippetTagResponse])
async def list_tags(db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> list[SnippetTagResponse]:
    tags = service.list_tags(db)
    return [SnippetTagResponse(id=int(item.id), name=str(item.name)) for item in tags]


@router.post("", response_model=SnippetResponse)
async def create_snippet(
    payload: SnippetUpsertRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetResponse:
    try:
        snippet = service.create_snippet(
            db,
            payload.title,
            payload.description,
            payload.language,
            payload.code_content,
            payload.folder_id,
            payload.tags,
            payload.is_public,
        )
        return _snippet_to_payload(db, snippet)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/{snippet_id}", response_model=SnippetResponse)
async def update_snippet(
    snippet_id: int,
    payload: SnippetUpsertRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetResponse:
    try:
        snippet = service.update_snippet(
            db,
            snippet_id,
            payload.title,
            payload.description,
            payload.language,
            payload.code_content,
            payload.folder_id,
            payload.tags,
            payload.is_public,
        )
        return _snippet_to_payload(db, snippet)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/{snippet_id}")
async def delete_snippet(snippet_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        service.delete_snippet(db, snippet_id)
        return {"message": "代码片已删除"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("", response_model=SnippetListResponse)
async def list_snippets(
    query: str = "",
    language: str = "all",
    folder_id: int | None = None,
    tag: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetListResponse:
    snippets = service.list_snippets(db, query, language, folder_id, tag)
    payloads = [_snippet_to_payload(db, item) for item in snippets]
    return SnippetListResponse(total=len(payloads), items=payloads)


@router.get("/{snippet_id}", response_model=SnippetResponse)
async def get_snippet(snippet_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> SnippetResponse:
    try:
        snippet = service.get_snippet(db, snippet_id)
        return _snippet_to_payload(db, snippet)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{snippet_id}/download")
async def download_snippet(snippet_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> Response:
    try:
        snippet = service.get_snippet(db, snippet_id)
        code_content = service.read_snippet_content(snippet)
        file_name = service.build_download_file_name(snippet)
        content_disposition = f"attachment; filename*=UTF-8''{quote(file_name, safe='')}"
        return Response(
            content=code_content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": content_disposition},
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{snippet_id}/shares", response_model=SnippetShareResponse)
async def create_share(
    request: Request,
    snippet_id: int,
    payload: SnippetShareCreateRequest,
    db: Session = Depends(get_db),
    _: str = Depends(admin_auth),
) -> SnippetShareResponse:
    try:
        share = service.create_share(
            db,
            snippet_id,
            payload.password,
            payload.expires_minutes,
            payload.max_access_count,
            payload.is_one_time,
        )
        snippet = service.get_snippet(db, int(share.snippet_id))
        return _share_payload(request, share, snippet)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/shares/list", response_model=list[SnippetShareResponse])
async def list_shares(request: Request, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> list[SnippetShareResponse]:
    rows = service.list_shares(db)
    return [_share_payload(request, share, snippet) for share, snippet in rows]


@router.delete("/shares/{share_id}")
async def cancel_share(share_id: int, db: Session = Depends(get_db), _: str = Depends(admin_auth)) -> dict[str, str]:
    try:
        service.cancel_share(db, share_id)
        return {"message": "分享已取消"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/public/{share_code}/access", response_model=SnippetPublicAccessResponse)
async def access_share(
    request: Request,
    share_code: str,
    payload: SnippetPublicAccessRequest,
    db: Session = Depends(get_db),
) -> SnippetPublicAccessResponse:
    try:
        share, snippet = service.access_share(db, share_code, payload.password)
        snippet_payload = _snippet_to_payload(db, snippet)
        download_url = f"{_base_url(request)}/api/snippets/public/{share_code}/download?password={quote(payload.password, safe='')}"
        return SnippetPublicAccessResponse(
            share_code=str(share.share_code),
            snippet=snippet_payload,
            download_url=download_url,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/public/{share_code}/download")
async def download_public_share(share_code: str, password: str = "", db: Session = Depends(get_db)) -> Response:
    try:
        _, snippet = service.access_share(db, share_code, password)
        code_content = service.read_snippet_content(snippet)
        file_name = service.build_download_file_name(snippet)
        content_disposition = f"attachment; filename*=UTF-8''{quote(file_name, safe='')}"
        return Response(
            content=code_content.encode("utf-8"),
            media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": content_disposition},
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/styles/highlight.css", response_class=HTMLResponse)
async def highlight_styles() -> str:
    return service.highlight_css()

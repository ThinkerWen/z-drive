from __future__ import annotations

import ipaddress

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_admin_token, decode_admin_token
from app.db.session import get_db
from app.schemas.image import DeleteImageRequest, ImageInfoResponse, LoginRequest, UpdateImageRequest
from app.services.imagebed import ImageBedService

public_router = APIRouter(tags=["imagebed"])
image_router = APIRouter(prefix="/gallery", tags=["imagebed"])
settings = get_settings()
service = ImageBedService(settings)


def _base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _cache_headers() -> dict[str, str]:
    if settings.enable_browser_cache:
        return {"Cache-Control": "public, max-age=31536000, immutable"}
    return {"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}


def _admin_token_or_401(request: Request) -> str:
    token = request.cookies.get("z_drive_admin_token") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        return decode_admin_token(token, settings.jwt_secret)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="登录已过期") from exc


def _normalize_ip(raw_ip: str) -> str:
    ip = raw_ip.strip().strip('"').strip("'")
    if not ip or ip.lower() in {"unknown", "null", "none"}:
        return ""
    if ip.startswith("[") and ip.endswith("]"):
        ip = ip[1:-1]
    return ip


def _is_loopback_ip(ip: str) -> bool:
    if ip.lower() in {"localhost", "::1"}:
        return True
    try:
        return ipaddress.ip_address(ip).is_loopback
    except ValueError:
        return False


def _extract_client_ip(request: Request) -> str:
    candidates: list[str] = []

    x_forwarded_for = request.headers.get("x-forwarded-for", "")
    if x_forwarded_for:
        candidates.extend(part.strip() for part in x_forwarded_for.split(",") if part.strip())

    x_real_ip = request.headers.get("x-real-ip", "").strip()
    if x_real_ip:
        candidates.append(x_real_ip)

    client = request.client
    if client is not None and client.host:
        candidates.append(client.host)

    normalized_candidates = [_normalize_ip(candidate) for candidate in candidates]
    normalized_candidates = [candidate for candidate in normalized_candidates if candidate]

    for candidate in normalized_candidates:
        if not _is_loopback_ip(candidate):
            return candidate

    return ""


def _request_meta(request: Request) -> tuple[str, str, str]:
    ip = _extract_client_ip(request)

    user_agent = request.headers.get("user-agent", "")
    referer = request.headers.get("referer", "")
    return ip, user_agent, referer


def _split_file_key(file_key: str) -> tuple[str, str]:
    short_code, sep, ext = file_key.partition(".")
    if not sep or not short_code or not ext:
        raise HTTPException(status_code=404, detail="图片不存在")
    return short_code, ext


def _build_original_file_response(request: Request, db: Session, file_key: str, sign: str) -> Response:
    short_code, _ = _split_file_key(file_key)
    image = service.get_image(db, short_code, sign)
    ip, user_agent, referer = _request_meta(request)
    service.record_access(db, image, "download", ip, user_agent, referer)
    data = service.get_original_image_data(image)
    headers = _cache_headers()
    headers["Content-Disposition"] = f'attachment; filename="{str(image.file_name)}"'
    return Response(content=data, media_type=str(image.mime_type), headers=headers)


@public_router.get("/i/{file_key}")
async def view_image(request: Request, file_key: str, sign: str = "", db: Session = Depends(get_db)) -> Response:
    try:
        short_code, _ = _split_file_key(file_key)
        image = service.get_image(db, short_code, sign)
        ip, user_agent, referer = _request_meta(request)
        service.record_access(db, image, "view", ip, user_agent, referer)
        if settings.view_origin or image.file_type != "image":
            data = service.get_original_image_data(image)
            mime_type = str(image.mime_type)
        else:
            data, mime_type = service.get_compressed_view(image)
        return Response(content=data, media_type=mime_type, headers=_cache_headers())
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@image_router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    access_mode: str = Form("none"),
    db: Session = Depends(get_db),
) -> dict:
    try:
        image, sign = await service.upload_file(db, file, access_mode or "none")
        return service.build_upload_payload(image, _base_url(request), sign)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@image_router.post("/upload/multiple")
async def upload_multiple(
    request: Request,
    files: list[UploadFile] = File(...),
    access_mode: str = Form("none"),
    db: Session = Depends(get_db),
) -> dict:
    results: list[dict] = []
    for file in files:
        try:
            image, sign = await service.upload_file(db, file, access_mode or "none")
            payload = service.build_upload_payload(image, _base_url(request), sign)
            results.append({"file_name": file.filename, "success": True, **payload})
        except Exception as exc:  # noqa: BLE001
            results.append({"file_name": file.filename, "success": False, "error": str(exc)})
    return {"total": len(files), "results": results}


@image_router.get("/file/{file_key}")
async def get_image_file(request: Request, file_key: str, sign: str = "", db: Session = Depends(get_db)) -> Response:
    try:
        return _build_original_file_response(request, db, file_key, sign)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@image_router.get("/info/{file_key}")
async def get_image_info(request: Request, file_key: str, sign: str = "", db: Session = Depends(get_db)) -> dict:
    try:
        short_code, _ = _split_file_key(file_key)
        image = service.get_image(db, short_code, sign)
        ip, user_agent, referer = _request_meta(request)
        service.record_access(db, image, "info", ip, user_agent, referer)
        return ImageInfoResponse(
            short_code=str(image.short_code),
            file_name=str(image.file_name),
            file_size=int(image.file_size),
            file_type=str(image.file_type),
            mime_type=str(image.mime_type),
            width=int(image.width),
            height=int(image.height),
            view_count=int(image.view_count),
            download_count=int(image.download_count),
            created_at=image.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        ).model_dump()
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@image_router.get("/download/{file_key}")
async def download_image(request: Request, file_key: str, sign: str = "", db: Session = Depends(get_db)) -> Response:
    try:
        return _build_original_file_response(request, db, file_key, sign)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@image_router.get("/list")
async def list_images(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    file_type: str = "all",
    query: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(_admin_token_or_401),
) -> dict:
    payload = service.list_images(db, page, page_size, file_type, query, _base_url(request))
    return payload


@image_router.get("/stats")
async def stats(db: Session = Depends(get_db), _: str = Depends(_admin_token_or_401)) -> dict:
    return service.get_stats(db)


@image_router.delete("/delete/{short_code}")
async def delete_image(short_code: str, db: Session = Depends(get_db), _: str = Depends(_admin_token_or_401)) -> dict:
    try:
        service.delete_image(db, short_code)
        return {"message": "删除成功"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@image_router.post("/login")
async def login(payload: LoginRequest) -> JSONResponse:
    if payload.username != settings.admin_username or payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_admin_token(payload.username, settings.jwt_secret, settings.jwt_expire_minutes)
    response = JSONResponse(content={"message": "登录成功", "token": token})
    response.set_cookie("z_drive_admin_token", token, httponly=True, samesite="lax", path="/")
    return response


@image_router.get("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse(url="/gallery/login", status_code=302)
    response.delete_cookie("z_drive_admin_token", path="/")
    return response


@image_router.get("/api/list")
async def manage_list(
    request: Request,
    page: int = 1,
    page_size: int = 20,
    file_type: str = "all",
    query: str = "",
    db: Session = Depends(get_db),
    _: str = Depends(_admin_token_or_401),
) -> dict:
    return service.list_images(db, page, page_size, file_type, query, _base_url(request))


@image_router.post("/api/update")
async def manage_update(payload: UpdateImageRequest, db: Session = Depends(get_db), _: str = Depends(_admin_token_or_401)) -> dict:
    try:
        image = service.update_image_access_mode(db, payload.shortcode, payload.access_mode or "none", payload.sign)
        return {"message": "更新成功", "access_mode": image.access_mode, "sign": image.sign}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@image_router.post("/api/delete")
async def manage_delete(payload: DeleteImageRequest, db: Session = Depends(get_db), _: str = Depends(_admin_token_or_401)) -> dict:
    try:
        service.delete_image(db, payload.shortcode)
        return {"message": "删除成功"}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@image_router.post("/api/upload")
async def manage_upload(
    request: Request,
    file: UploadFile = File(...),
    access_mode: str = Form("none"),
    db: Session = Depends(get_db),
    _: str = Depends(_admin_token_or_401),
) -> dict:
    image, sign = await service.upload_file(db, file, access_mode or "none")
    return service.build_upload_payload(image, _base_url(request), sign)


@image_router.post("/api/upload/multiple")
async def manage_upload_multiple(
    request: Request,
    files: list[UploadFile] = File(...),
    access_mode: str = Form("none"),
    db: Session = Depends(get_db),
    _: str = Depends(_admin_token_or_401),
) -> dict:
    results: list[dict] = []
    for file in files:
        try:
            image, sign = await service.upload_file(db, file, access_mode or "none")
            results.append({"file_name": file.filename, "success": True, **service.build_upload_payload(image, _base_url(request), sign)})
        except Exception as exc:  # noqa: BLE001
            results.append({"file_name": file.filename, "success": False, "error": str(exc)})
    return {"total": len(files), "results": results}


@image_router.get("/api/stats")
async def manage_stats(db: Session = Depends(get_db), _: str = Depends(_admin_token_or_401)) -> dict:
    return service.get_stats(db)
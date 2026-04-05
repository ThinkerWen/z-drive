from __future__ import annotations

import json
from time import perf_counter

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import logger


def _error_message(detail: object, default: str) -> str:
    if isinstance(detail, str) and detail.strip():
        return detail
    if isinstance(detail, dict):
        candidate = detail.get("message")
        if isinstance(candidate, str) and candidate.strip():
            return candidate
        return json.dumps(detail, ensure_ascii=False)
    if isinstance(detail, list) and detail:
        first = detail[0]
        if isinstance(first, dict):
            msg = first.get("msg")
            loc = first.get("loc")
            if isinstance(msg, str):
                if isinstance(loc, list) and loc:
                    return f"参数校验失败: {'.'.join(map(str, loc))} - {msg}"
                return f"参数校验失败: {msg}"
        return json.dumps(detail, ensure_ascii=False)
    return default


def register_http_handlers(app: FastAPI) -> None:
    @app.exception_handler(HTTPException)
    async def unified_http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": -1,
                "data": {},
                "message": _error_message(exc.detail, "请求失败"),
            },
        )

    @app.exception_handler(RequestValidationError)
    async def unified_validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": -1,
                "data": {},
                "message": _error_message(exc.errors(), "参数校验失败"),
            },
        )

    @app.exception_handler(Exception)
    async def unified_unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={
                "code": -1,
                "data": {},
                "message": _error_message(str(exc), "服务器内部错误"),
            },
        )

    @app.middleware("http")
    async def request_logging_and_response_wrap_middleware(request: Request, call_next):
        started_at = perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (perf_counter() - started_at) * 1000
            logger.exception("{} {} -> 500 ({:.2f} ms)", request.method, request.url.path, elapsed_ms)
            raise

        elapsed_ms = (perf_counter() - started_at) * 1000
        logger.info("{} {} -> {} ({:.2f} ms)", request.method, request.url.path, response.status_code, elapsed_ms)

        should_wrap = (
            request.url.path.startswith("/api")
            and 200 <= response.status_code < 300
            and "application/json" in response.headers.get("content-type", "")
        )
        if not should_wrap:
            return response

        raw_body = getattr(response, "body", None)
        if not raw_body:
            chunks: list[bytes] = []
            async for chunk in response.body_iterator:
                chunks.append(chunk)
            raw_body = b"".join(chunks)

        raw_body = raw_body or b""
        try:
            payload = json.loads(raw_body.decode("utf-8") if raw_body else "null")
        except Exception:  # noqa: BLE001
            return response

        if isinstance(payload, dict) and {"code", "data", "message"}.issubset(payload.keys()):
            wrapped = payload
        else:
            wrapped = {
                "code": 0,
                "data": payload if payload is not None else {},
                "message": "success",
            }

        new_response = JSONResponse(status_code=response.status_code, content=wrapped)

        for key, value in response.headers.items():
            lower_key = key.lower()
            if lower_key in {"content-length", "content-type", "set-cookie"}:
                continue
            new_response.headers[key] = value

        try:
            set_cookie_values = response.headers.getlist("set-cookie")
        except Exception:  # noqa: BLE001
            set_cookie_values = [response.headers.get("set-cookie", "")]

        for set_cookie in set_cookie_values:
            if set_cookie:
                new_response.headers.append("set-cookie", set_cookie)

        return new_response

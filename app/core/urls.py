from __future__ import annotations

from fastapi import Request


def get_external_base_url(request: Request) -> str:
    forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
    forwarded_host = request.headers.get("x-forwarded-host", "").split(",")[0].strip()
    cf_visitor = request.headers.get("cf-visitor", "")

    scheme = forwarded_proto or request.url.scheme
    if '"scheme":"https"' in cf_visitor.lower():
        scheme = "https"

    host = forwarded_host or request.headers.get("host", "").strip()
    if not host:
        host = request.url.netloc

    if scheme not in {"http", "https"}:
        scheme = "https" if request.url.scheme == "https" else "http"

    return f"{scheme}://{host}".rstrip("/")
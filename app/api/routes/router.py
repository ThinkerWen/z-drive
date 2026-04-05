from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from app.api.routes.cloud import router as cloud_router, service as cloud_service
from app.api.routes.frontend import create_frontend_router
from app.api.routes.gallery import gallery_router, public_router, service as gallery_service
from app.api.routes.health import router as health_router


def ensure_storage_directories() -> None:
    gallery_service.ensure_directories()
    cloud_service.ensure_directories()


def register_routes(app: FastAPI, index_file: Path | None = None) -> None:
    if index_file is not None and index_file.exists():
        app.include_router(create_frontend_router(index_file))

    app.include_router(health_router, prefix="/api")
    app.include_router(public_router)
    app.include_router(gallery_router, prefix="/api")
    app.include_router(cloud_router, prefix="/api")

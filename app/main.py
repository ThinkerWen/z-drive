from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes.health import router as health_router
from app.api.routes.imagebed import image_router, public_router, service
from app.core.config import get_settings
from app.core.logging import logger, setup_logging
from app.db.session import init_db

settings = get_settings()
setup_logging(settings.debug)
base_dir = Path(__file__).resolve().parent
static_dir = base_dir / "static"


@asynccontextmanager
async def app_lifespan(_: FastAPI):
    init_db()
    service.ensure_directories()
    logger.info("{} started", settings.app_name)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=app_lifespan)
    app.state.settings = settings

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        started_at = perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed_ms = (perf_counter() - started_at) * 1000
            logger.exception("{} {} -> 500 ({:.2f} ms)", request.method, request.url.path, elapsed_ms)
            raise

        elapsed_ms = (perf_counter() - started_at) * 1000
        logger.info("{} {} -> {} ({:.2f} ms)", request.method, request.url.path, response.status_code, elapsed_ms)
        return response

    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        index_file = static_dir / "index.html"

        if index_file.exists():

            @app.get("/", include_in_schema=False)
            @app.get("/gallery/index", include_in_schema=False)
            @app.get("/gallery/gallery", include_in_schema=False)
            @app.get("/gallery/stats", include_in_schema=False)
            @app.get("/gallery/login", include_in_schema=False)
            @app.get("/gallery/error", include_in_schema=False)
            @app.get("/gallery/preview/{preview_path:path}", include_in_schema=False)
            async def frontend_index() -> FileResponse:
                return FileResponse(index_file)

    app.include_router(health_router)
    app.include_router(public_router)
    app.include_router(image_router)
    return app


app = create_app()
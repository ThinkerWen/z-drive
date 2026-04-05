from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.router import ensure_storage_directories, register_routes
from app.core.config import get_settings
from app.core.corn import start_corn, stop_corn
from app.core.http import register_http_handlers
from app.core.logging import logger, setup_logging
from app.db.session import init_db

settings = get_settings()
setup_logging(settings.debug)
base_dir = Path(__file__).resolve().parent
static_dir = base_dir / "static"


@asynccontextmanager
async def app_lifespan(app: FastAPI):
    init_db()
    ensure_storage_directories()
    start_corn(app, settings)
    logger.info("{} started", settings.app_name)
    try:
        yield
    finally:
        await stop_corn(app)

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=app_lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    openapi_url="/openapi.json" if settings.debug else None,
)
app.state.settings = settings
register_http_handlers(app)

if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    index_file = static_dir / "index.html"
else:
    index_file = None

register_routes(app, index_file)


def main() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
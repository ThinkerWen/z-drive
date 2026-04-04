from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.routes.health import router as health_router
from app.api.routes.imagebed import image_router, public_router, service
from app.core.config import get_settings
from app.db.session import init_db

settings = get_settings()
base_dir = Path(__file__).resolve().parent
templates_dir = base_dir / "templates"
static_dir = base_dir / "static"


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.debug)
    app.state.settings = settings
    app.state.templates = Jinja2Templates(directory=str(templates_dir))

    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        index_file = static_dir / "index.html"

        if index_file.exists():

            @app.get("/", include_in_schema=False)
            @app.get("/gallery/index", include_in_schema=False)
            @app.get("/gallery/gallery", include_in_schema=False)
            @app.get("/gallery/stats", include_in_schema=False)
            @app.get("/gallery/login", include_in_schema=False)
            async def frontend_index() -> FileResponse:
                return FileResponse(index_file)

    @app.on_event("startup")
    async def startup() -> None:
        init_db()
        service.ensure_directories()

    app.include_router(health_router)
    app.include_router(public_router)
    app.include_router(image_router)
    return app


app = create_app()
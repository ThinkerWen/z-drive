from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse


FRONTEND_ENTRY_PATHS = (
    "/",
    "/gallery/index",
    "/gallery/gallery",
    "/gallery/stats",
    "/gallery/login",
    "/gallery/error",
    "/gallery/preview/{preview_path:path}",
)


def create_frontend_router(index_file: Path) -> APIRouter:
    router = APIRouter(include_in_schema=False)

    async def frontend_index() -> FileResponse:
        return FileResponse(index_file)

    for path in FRONTEND_ENTRY_PATHS:
        router.add_api_route(path, frontend_index, methods=["GET"])

    return router

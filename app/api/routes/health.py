from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def root() -> dict:
    return {"message": "z-drive is running"}


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}
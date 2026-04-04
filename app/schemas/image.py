from __future__ import annotations

from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    short_code: str
    file_name: str
    file_size: int
    file_type: str
    width: int = 0
    height: int = 0
    view_url: str
    direct_url: str
    preview_url: str
    download_url: str
    sign: str | None = None


class UploadItemResponse(BaseModel):
    file_name: str
    success: bool
    short_code: str | None = None
    view_url: str | None = None
    direct_url: str | None = None
    preview_url: str | None = None
    download_url: str | None = None
    sign: str | None = None
    error: str | None = None


class ImageListRequest(BaseModel):
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=200)
    file_type: str = "all"
    query: str = ""


class ImageListItem(BaseModel):
    id: int
    short_code: str
    file_name: str
    file_size: int
    file_type: str
    mime_type: str
    width: int = 0
    height: int = 0
    view_count: int
    download_count: int
    view_url: str
    direct_url: str
    preview_url: str
    download_url: str
    access_mode: str
    sign: str | None = None
    created_at: str


class ImageListResponse(BaseModel):
    total: int
    page: int
    items: list[ImageListItem]


class ImageInfoResponse(BaseModel):
    short_code: str
    file_name: str
    file_size: int
    file_type: str
    mime_type: str
    width: int = 0
    height: int = 0
    view_count: int
    download_count: int
    created_at: str


class TopImageItem(BaseModel):
    short_code: str
    file_name: str
    file_type: str
    view_count: int


class TopRefererItem(BaseModel):
    referer: str
    count: int


class TopOriginItem(BaseModel):
    origin_ip: str
    count: int


class DailyStatsItem(BaseModel):
    date: str
    views: int
    downloads: int
    uploads: int


class StatsResponse(BaseModel):
    total_images: int
    total_size: int
    total_views: int
    total_downloads: int
    today_views: int
    today_uploads: int
    top_images: list[TopImageItem]
    top_refers: list[TopRefererItem]
    top_origins: list[TopOriginItem]
    daily_stats: list[DailyStatsItem]


class LoginRequest(BaseModel):
    username: str
    password: str


class UpdateImageRequest(BaseModel):
    shortcode: str
    access_mode: str = "none"
    sign: str = ""


class DeleteImageRequest(BaseModel):
    shortcode: str
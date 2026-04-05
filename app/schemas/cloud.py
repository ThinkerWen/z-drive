from __future__ import annotations

from pydantic import BaseModel, Field


class DriveCreateFolderRequest(BaseModel):
    parent_id: int | None = None
    name: str = Field(min_length=1, max_length=255)


class DriveRenameRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class DriveMoveRequest(BaseModel):
    target_parent_id: int | None = None


class DriveCopyRequest(BaseModel):
    target_parent_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)


class DriveVisibilityRequest(BaseModel):
    is_public: bool


class DriveBatchDeleteRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)


class DriveBatchMoveRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)
    target_parent_id: int | None = None


class DriveBatchCopyRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)
    target_parent_id: int | None = None


class DriveItemResponse(BaseModel):
    id: int
    parent_id: int | None
    name: str
    is_folder: bool
    file_size: int
    mime_type: str
    file_ext: str
    is_public: bool
    duplicate_of_id: int | None = None
    created_at: str
    updated_at: str


class DriveListResponse(BaseModel):
    parent_id: int | None
    items: list[DriveItemResponse]


class DriveUploadMultipleResponse(BaseModel):
    total: int
    success: int
    failed: int
    items: list[DriveItemResponse]
    errors: list[dict[str, str]]


class DriveBatchResultResponse(BaseModel):
    total: int
    success: int
    failed: int
    message: str


class DriveSummaryResponse(BaseModel):
    total_items: int
    total_files: int
    total_folders: int
    total_size: int
    total_space: int
    available_space: int
    recent_uploads: list[DriveItemResponse]
    recent_top_visits: list[DriveTopVisitResponse]


class DriveTopVisitResponse(BaseModel):
    item_id: int
    item_name: str
    visit_count: int
    last_accessed_at: str | None


class DriveCreateShareRequest(BaseModel):
    item_id: int
    password: str = ""
    expires_minutes: int | None = Field(default=None, ge=1)


class DriveShareResponse(BaseModel):
    id: int
    item_id: int
    item_name: str = ""
    share_code: str
    has_password: bool
    is_active: bool
    expires_at: str | None
    created_at: str
    share_url: str


class DriveShareAccessRequest(BaseModel):
    password: str = ""


class DriveShareAccessResponse(BaseModel):
    share_code: str
    item: DriveItemResponse
    preview_url: str
    download_url: str


class DriveShareAccessLogResponse(BaseModel):
    id: int
    share_id: int
    access_ip: str
    user_agent: str
    referer: str
    created_at: str


class DriveChunkInitRequest(BaseModel):
    parent_id: int | None = None
    file_name: str = Field(min_length=1, max_length=255)
    total_chunks: int = Field(ge=1)
    mime_type: str = "application/octet-stream"


class DriveChunkInitResponse(BaseModel):
    upload_id: str
    total_chunks: int
    uploaded_chunks: list[int]


class DriveChunkStatusResponse(BaseModel):
    upload_id: str
    total_chunks: int
    uploaded_chunks: list[int]
    uploaded_bytes: int
    average_speed_bytes: int
    paused: bool


class DriveChunkTaskResponse(BaseModel):
    upload_id: str
    file_name: str
    total_chunks: int
    uploaded_chunks: list[int]
    uploaded_bytes: int
    paused: bool


class DriveChunkCompleteResponse(BaseModel):
    upload_id: str
    item: DriveItemResponse


class DriveFastUploadCheckRequest(BaseModel):
    parent_id: int | None = None
    file_name: str = Field(min_length=1, max_length=255)
    sha256: str = Field(min_length=64, max_length=64)


class DriveFastUploadCheckResponse(BaseModel):
    exists: bool
    source_item_id: int | None = None
    message: str


class DriveFastUploadSaveRequest(BaseModel):
    source_item_id: int
    parent_id: int | None = None
    file_name: str = Field(min_length=1, max_length=255)

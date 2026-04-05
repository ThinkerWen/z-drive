from __future__ import annotations

from pydantic import BaseModel, Field


class SnippetFolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=255)


class SnippetFolderResponse(BaseModel):
    id: int
    name: str
    description: str


class SnippetTagCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class SnippetTagResponse(BaseModel):
    id: int
    name: str


class SnippetUpsertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=500)
    language: str = Field(default="auto", min_length=1, max_length=60)
    code_content: str = Field(min_length=1)
    folder_id: int | None = None
    tags: list[str] = Field(default_factory=list)
    is_public: bool = False


class SnippetResponse(BaseModel):
    id: int
    title: str
    description: str
    language: str
    detected_language: str
    effective_language: str
    code_content: str
    highlighted_html: str
    line_count: int
    folder_id: int | None
    folder_name: str | None = None
    tags: list[str]
    is_public: bool
    created_at: str
    updated_at: str


class SnippetListResponse(BaseModel):
    total: int
    items: list[SnippetResponse]


class SnippetShareCreateRequest(BaseModel):
    password: str = ""
    expires_minutes: int | None = Field(default=None, ge=1)
    max_access_count: int | None = Field(default=None, ge=1)
    is_one_time: bool = False


class SnippetShareResponse(BaseModel):
    id: int
    snippet_id: int
    snippet_title: str
    share_code: str
    share_url: str
    has_password: bool
    expires_at: str | None
    max_access_count: int | None
    access_count: int
    is_one_time: bool
    is_active: bool
    created_at: str
    last_accessed_at: str | None


class SnippetPublicAccessRequest(BaseModel):
    password: str = ""


class SnippetPublicAccessResponse(BaseModel):
    share_code: str
    snippet: SnippetResponse
    download_url: str


class SnippetDownloadResponse(BaseModel):
    file_name: str

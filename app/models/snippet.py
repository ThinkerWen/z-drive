from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class SnippetFolder(Base):
    __tablename__ = "z_drive_snippet_folders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class SnippetTag(Base):
    __tablename__ = "z_drive_snippet_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class Snippet(Base):
    __tablename__ = "z_drive_snippets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    folder_id: Mapped[int | None] = mapped_column(ForeignKey("z_drive_snippet_folders.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    language: Mapped[str] = mapped_column(String(60), default="auto", nullable=False)
    detected_language: Mapped[str] = mapped_column(String(60), default="text", nullable=False)
    content_path: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    content_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    code_content: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class SnippetTagBinding(Base):
    __tablename__ = "z_drive_snippet_tag_bindings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snippet_id: Mapped[int] = mapped_column(ForeignKey("z_drive_snippets.id"), index=True, nullable=False)
    tag_id: Mapped[int] = mapped_column(ForeignKey("z_drive_snippet_tags.id"), index=True, nullable=False)


class SnippetShare(Base):
    __tablename__ = "z_drive_snippet_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    snippet_id: Mapped[int] = mapped_column(ForeignKey("z_drive_snippets.id"), index=True, nullable=False)
    share_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    max_access_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_one_time: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

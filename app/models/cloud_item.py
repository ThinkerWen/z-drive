from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DriveItem(Base):
    __tablename__ = "z_drive_cloud_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("z_drive_cloud_items.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_folder: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(600), default="", nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    file_ext: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    is_delete: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)

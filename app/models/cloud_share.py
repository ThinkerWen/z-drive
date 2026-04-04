from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class DriveShare(Base):
    __tablename__ = "z_drive_cloud_shares"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("z_drive_cloud_items.id"), nullable=False, index=True)
    share_code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class DriveShareAccessLog(Base):
    __tablename__ = "z_drive_cloud_share_access_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    share_id: Mapped[int] = mapped_column(ForeignKey("z_drive_cloud_shares.id"), nullable=False, index=True)
    share_code: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    access_ip: Mapped[str] = mapped_column(String(45), default="", nullable=False)
    user_agent: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    referer: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

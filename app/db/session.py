from __future__ import annotations

import os
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine_kwargs: dict[str, Any] = {"future": True}
if settings.database_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models.cloud_item import DriveItem  # noqa: F401
    from app.models.cloud_share import DriveShare, DriveShareAccessLog  # noqa: F401
    from app.models.image import Image, ImageAccessLog, ImageStats  # noqa: F401
    from app.models.snippet import Snippet, SnippetFolder, SnippetShare, SnippetTag, SnippetTagBinding  # noqa: F401

    if settings.database_url.startswith("sqlite"):
        try:
            url = make_url(settings.database_url)
            db_file = url.database
            db_dir = os.path.dirname(db_file) or "."
            os.makedirs(db_dir, exist_ok=True)
        except Exception:
            pass

    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_snippet_columns()


def _ensure_sqlite_snippet_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return

    required_columns = {
        "content_path": "ALTER TABLE z_drive_snippets ADD COLUMN content_path VARCHAR(255) NOT NULL DEFAULT ''",
        "content_size": "ALTER TABLE z_drive_snippets ADD COLUMN content_size INTEGER NOT NULL DEFAULT 0",
        "content_hash": "ALTER TABLE z_drive_snippets ADD COLUMN content_hash VARCHAR(64) NOT NULL DEFAULT ''",
    }

    with engine.begin() as connection:
        existing_rows = connection.execute(text("PRAGMA table_info('z_drive_snippets')")).fetchall()
        existing_columns = {str(row[1]) for row in existing_rows}

        for column_name, ddl in required_columns.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(ddl))
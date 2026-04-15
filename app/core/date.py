from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def utc_now_naive() -> datetime:
    """Return current UTC time as naive datetime for DB compatibility."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def app_timezone() -> ZoneInfo:
    settings = get_settings()
    return ZoneInfo(settings.app_timezone)


def to_app_timezone(value: datetime | None) -> datetime | None:
    if value is None:
        return None

    if value.tzinfo is None:
        aware = value.replace(tzinfo=timezone.utc)
    else:
        aware = value

    return aware.astimezone(app_timezone())


def format_app_datetime(value: datetime | None, fmt: str = "%Y-%m-%d %H:%M:%S") -> str | None:
    converted = to_app_timezone(value)
    if converted is None:
        return None
    return converted.strftime(fmt)

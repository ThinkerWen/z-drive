from functools import lru_cache
from datetime import timedelta, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


_FALLBACK_OFFSET_HOURS: dict[str, int] = {
    "UTC": 0,
    "PRC": 8,
    "Etc/UTC": 0,
    "Asia/Tokyo": 9,
    "Asia/Shanghai": 8,
    "Asia/Chongqing": 8,
}


def parse_timezone(value: str) -> tzinfo:
    key = value.strip()
    if not key:
        raise ValueError("Timezone cannot be empty")

    try:
        return ZoneInfo(key)
    except ZoneInfoNotFoundError:
        offset_hours = _FALLBACK_OFFSET_HOURS.get(key)
        if offset_hours is None:
            raise ValueError(f"Invalid timezone: {value}")
        return timezone(timedelta(hours=offset_hours), name=key)


def validate_timezone(value: str) -> str:
    parse_timezone(value)
    return value.strip()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "z-drive"
    debug: bool = False

    database_url: str = Field(default="sqlite:///./storage/z_drive.db")
    storage_path: str = Field(default="storage")
    app_timezone: str = Field(default="Asia/Shanghai")

    view_origin: bool = False
    enable_browser_cache: bool = True
    image_max_file_size_mb: int = 50
    cloud_total_space_mb: int = 10240
    image_auth_mode: str = "none"
    sign_salt: str = "change-me"

    admin_username: str = "admin"
    admin_password: str = "admin123"
    admin_token: str = "z-drive-change-me-admin-token"
    jwt_secret: str = "z-drive-change-me-secret-key-at-least-32-bytes"
    jwt_expire_minutes: int = 7 * 24 * 60

    @field_validator("app_timezone")
    @classmethod
    def validate_app_timezone(cls, value: str) -> str:
        return validate_timezone(value)


@lru_cache
def get_settings() -> Settings:
    return Settings()
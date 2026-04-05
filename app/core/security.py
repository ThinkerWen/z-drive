from __future__ import annotations

import hashlib
import secrets
import string
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request


def _normalize_hs256_secret(secret: str) -> str:
    if len(secret.encode("utf-8")) >= 32:
        return secret
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def generate_short_code(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def sanitize_filename(filename: str) -> str:
    cleaned = filename.replace("\\", "/").split("/")[-1]
    cleaned = cleaned.strip().replace(" ", "_")
    return "".join(character if character.isalnum() or character in {".", "-", "_"} else "_" for character in cleaned)


def generate_individual_sign() -> str:
    return secrets.token_hex(16)


def build_global_sign(salt: str, storage_name: str) -> str:
    return hashlib.md5(f"{salt}{storage_name}".encode("utf-8")).hexdigest()


def verify_global_sign(salt: str, storage_name: str, sign: str) -> bool:
    return build_global_sign(salt, storage_name) == sign


def create_admin_token(username: str, secret: str, expire_minutes: int) -> str:
    expire_at = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    payload = {"sub": username, "exp": expire_at}
    normalized_secret = _normalize_hs256_secret(secret)
    return jwt.encode(payload, normalized_secret, algorithm="HS256")


def decode_admin_token(token: str, secret: str) -> str:
    normalized_secret = _normalize_hs256_secret(secret)
    payload = jwt.decode(token, normalized_secret, algorithms=["HS256"])
    subject = payload.get("sub")
    if not subject:
        raise ValueError("invalid token")
    return str(subject)


def decode_admin_auth_token(token: str, jwt_secret: str, admin_token: str = "") -> str:
    normalized_admin_token = admin_token.strip()
    if normalized_admin_token and secrets.compare_digest(token, normalized_admin_token):
        return "admin_token"
    return decode_admin_token(token, jwt_secret)


def extract_request_admin_token(request: Request) -> str:
    return request.cookies.get("z_drive_admin_token") or request.headers.get("Authorization", "").removeprefix("Bearer ").strip()


def require_admin_auth(request: Request, jwt_secret: str, admin_token: str = "") -> str:
    token = extract_request_admin_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="未登录")
    try:
        return decode_admin_auth_token(token, jwt_secret, admin_token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="登录已过期或令牌无效") from exc


def build_admin_auth_dependency(jwt_secret: str, admin_token: str = ""):
    def _dependency(request: Request) -> str:
        return require_admin_auth(request, jwt_secret, admin_token)

    return _dependency
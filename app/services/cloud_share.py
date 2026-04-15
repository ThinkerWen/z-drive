from __future__ import annotations

import hashlib
import ipaddress
from datetime import timedelta

from fastapi import Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.date import utc_now_naive
from app.core.security import generate_short_code
from app.models.cloud_item import DriveItem
from app.models.cloud_share import DriveShare, DriveShareAccessLog


class DriveShareService:
    @staticmethod
    def _hash_password(password: str) -> str:
        if not password:
            return ""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def _build_share_code(db: Session) -> str:
        while True:
            code = generate_short_code(10)
            exists = db.scalar(select(DriveShare.id).where(DriveShare.share_code == code))
            if exists is None:
                return code

    @staticmethod
    def _normalize_ip(raw_ip: str) -> str:
        ip = raw_ip.strip().strip('"').strip("'")
        if not ip or ip.lower() in {"unknown", "null", "none"}:
            return ""
        if ip.startswith("[") and ip.endswith("]"):
            ip = ip[1:-1]
        return ip

    @staticmethod
    def _extract_client_ip(request: Request) -> str:
        candidates: list[str] = []
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            candidates.extend(part.strip() for part in xff.split(",") if part.strip())

        x_real_ip = request.headers.get("x-real-ip", "").strip()
        if x_real_ip:
            candidates.append(x_real_ip)

        client = request.client
        if client is not None and client.host:
            candidates.append(client.host)

        for candidate in candidates:
            normalized = DriveShareService._normalize_ip(candidate)
            if not normalized:
                continue
            try:
                if not ipaddress.ip_address(normalized).is_loopback:
                    return normalized
            except ValueError:
                continue
        return ""

    @staticmethod
    def create_share(db: Session, item_id: int, password: str, expires_minutes: int | None) -> DriveShare:
        item = db.scalar(select(DriveItem).where(DriveItem.id == item_id, DriveItem.is_delete.is_(False)))
        if item is None:
            raise LookupError("文件或目录不存在")

        expires_at = None
        if expires_minutes is not None and expires_minutes > 0:
            expires_at = utc_now_naive() + timedelta(minutes=expires_minutes)

        share = DriveShare(
            item_id=item_id,
            share_code=DriveShareService._build_share_code(db),
            password_hash=DriveShareService._hash_password(password),
            expires_at=expires_at,
            is_active=True,
        )
        db.add(share)
        db.commit()
        db.refresh(share)
        return share

    @staticmethod
    def list_shares(db: Session) -> list[DriveShare]:
        now = utc_now_naive()
        return db.scalars(
            select(DriveShare)
            .where(
                DriveShare.is_active.is_(True),
                or_(DriveShare.expires_at.is_(None), DriveShare.expires_at >= now),
            )
            .order_by(DriveShare.created_at.desc())
        ).all()

    @staticmethod
    def cleanup_expired_shares(db: Session) -> int:
        now = utc_now_naive()
        expired = db.scalars(
            select(DriveShare).where(
                DriveShare.is_active.is_(True),
                DriveShare.expires_at.is_not(None),
                DriveShare.expires_at < now,
            )
        ).all()

        if not expired:
            return 0

        for share in expired:
            share.is_active = False

        db.commit()
        return len(expired)

    @staticmethod
    def cancel_share(db: Session, share_id: int) -> None:
        share = db.scalar(select(DriveShare).where(DriveShare.id == share_id))
        if share is None:
            raise LookupError("分享不存在")
        share.is_active = False
        db.commit()

    @staticmethod
    def list_share_logs(db: Session, share_id: int) -> list[DriveShareAccessLog]:
        return db.scalars(
            select(DriveShareAccessLog).where(DriveShareAccessLog.share_id == share_id).order_by(DriveShareAccessLog.created_at.desc())
        ).all()

    @staticmethod
    def resolve_share(db: Session, share_code: str, password: str) -> tuple[DriveShare, DriveItem]:
        share = db.scalar(select(DriveShare).where(DriveShare.share_code == share_code))
        if share is None or not share.is_active:
            raise LookupError("分享不存在或已关闭")

        if share.expires_at is not None and share.expires_at < utc_now_naive():
            share.is_active = False
            db.commit()
            raise PermissionError("分享已过期")

        if share.password_hash and share.password_hash != DriveShareService._hash_password(password):
            raise PermissionError("分享密码错误")

        item = db.scalar(select(DriveItem).where(DriveItem.id == share.item_id, DriveItem.is_delete.is_(False)))
        if item is None:
            raise LookupError("分享文件不存在")

        return share, item

    @staticmethod
    def record_access(db: Session, share: DriveShare, request: Request) -> None:
        log = DriveShareAccessLog(
            share_id=share.id,
            share_code=share.share_code,
            access_ip=DriveShareService._extract_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            referer=request.headers.get("referer", ""),
        )
        db.add(log)
        db.commit()

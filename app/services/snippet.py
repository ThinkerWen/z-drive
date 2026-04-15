from __future__ import annotations

import hashlib
import importlib
import uuid
from datetime import timedelta
from html import escape
from pathlib import Path

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.date import utc_now_naive
from app.core.security import generate_short_code
from app.models.snippet import Snippet, SnippetFolder, SnippetShare, SnippetTag, SnippetTagBinding


class SnippetService:
    def __init__(self) -> None:
        settings = get_settings()
        self._snippet_root = Path(settings.storage_path) / "snippets"

    def ensure_directories(self) -> None:
        self._snippet_root.mkdir(parents=True, exist_ok=True)

    def _content_file(self, relative_path: str) -> Path:
        return self._snippet_root / relative_path

    def _write_content(self, snippet_id: int, code_content: str) -> tuple[str, int, str]:
        content_hash = hashlib.sha256(code_content.encode("utf-8")).hexdigest()
        bucket = f"{snippet_id % 256:02x}"
        relative_path = f"{bucket}/{uuid.uuid4().hex}.code"
        file_path = self._content_file(relative_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(code_content, encoding="utf-8")
        return relative_path, len(code_content.encode("utf-8")), content_hash

    def _delete_content_file(self, relative_path: str) -> None:
        if not relative_path:
            return
        file_path = self._content_file(relative_path)
        try:
            if file_path.exists():
                file_path.unlink()
        except Exception:  # noqa: BLE001
            pass

    def read_snippet_content(self, snippet: Snippet) -> str:
        if snippet.content_path:
            file_path = self._content_file(str(snippet.content_path))
            if file_path.exists():
                return file_path.read_text(encoding="utf-8")
        return str(snippet.code_content or "")

    @staticmethod
    def _load_pygments_components():
        try:
            pygments_module = importlib.import_module("pygments")
            formatters_module = importlib.import_module("pygments.formatters")
            lexers_module = importlib.import_module("pygments.lexers")
            special_lexers_module = importlib.import_module("pygments.lexers.special")
        except Exception:  # noqa: BLE001
            return None

        return {
            "highlight": getattr(pygments_module, "highlight", None),
            "HtmlFormatter": getattr(formatters_module, "HtmlFormatter", None),
            "get_lexer_by_name": getattr(lexers_module, "get_lexer_by_name", None),
            "guess_lexer": getattr(lexers_module, "guess_lexer", None),
            "TextLexer": getattr(special_lexers_module, "TextLexer", None),
        }

    @staticmethod
    def _normalize_language(language: str) -> str:
        candidate = language.strip().lower()
        if not candidate:
            return "auto"
        return candidate

    @staticmethod
    def _resolve_lexer(language: str, code_content: str):
        components = SnippetService._load_pygments_components()
        if not components:
            return "text", None

        get_lexer_by_name = components["get_lexer_by_name"]
        guess_lexer = components["guess_lexer"]
        text_lexer_cls = components["TextLexer"]

        normalized = SnippetService._normalize_language(language)
        if normalized != "auto" and callable(get_lexer_by_name):
            try:
                lexer = get_lexer_by_name(normalized)
                return normalized, lexer
            except Exception:  # noqa: BLE001
                pass

        if callable(guess_lexer):
            try:
                guessed = guess_lexer(code_content)
                detected = guessed.aliases[0] if guessed.aliases else "text"
                return detected, guessed
            except Exception:  # noqa: BLE001
                pass

        if text_lexer_cls is not None:
            return "text", text_lexer_cls()
        return "text", None

    @staticmethod
    def render_highlighted_html(code_content: str, language: str) -> tuple[str, str]:
        detected, lexer = SnippetService._resolve_lexer(language, code_content)
        components = SnippetService._load_pygments_components()
        if not components:
            return detected, SnippetService.escape_plain_preview(code_content)

        highlight = components["highlight"]
        formatter_cls = components["HtmlFormatter"]
        if not callable(highlight) or formatter_cls is None or lexer is None:
            return detected, SnippetService.escape_plain_preview(code_content)

        formatter = formatter_cls(nowrap=False, linenos="table", cssclass="snippet-highlight")
        return detected, highlight(code_content, lexer, formatter)

    @staticmethod
    def highlight_css() -> str:
        components = SnippetService._load_pygments_components()
        if not components:
            return ""

        formatter_cls = components["HtmlFormatter"]
        if formatter_cls is None:
            return ""
        return formatter_cls(linenos="table", cssclass="snippet-highlight").get_style_defs(".snippet-highlight")

    @staticmethod
    def _hash_password(password: str) -> str:
        if not password:
            return ""
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def _upsert_tags(db: Session, names: list[str]) -> list[SnippetTag]:
        normalized_names: list[str] = []
        for item in names:
            value = item.strip().lower()
            if value and value not in normalized_names:
                normalized_names.append(value)

        if not normalized_names:
            return []

        existing = db.scalars(select(SnippetTag).where(SnippetTag.name.in_(normalized_names))).all()
        by_name = {tag.name: tag for tag in existing}
        result: list[SnippetTag] = list(existing)

        for name in normalized_names:
            if name in by_name:
                continue
            created = SnippetTag(name=name)
            db.add(created)
            db.flush()
            result.append(created)
            by_name[name] = created

        return result

    @staticmethod
    def create_folder(db: Session, name: str, description: str) -> SnippetFolder:
        exists = db.scalar(select(SnippetFolder.id).where(func.lower(SnippetFolder.name) == name.strip().lower()))
        if exists is not None:
            raise ValueError("分组名称已存在")

        folder = SnippetFolder(name=name.strip(), description=description.strip())
        db.add(folder)
        db.commit()
        db.refresh(folder)
        return folder

    @staticmethod
    def list_folders(db: Session) -> list[SnippetFolder]:
        return db.scalars(select(SnippetFolder).order_by(SnippetFolder.name.asc())).all()

    @staticmethod
    def list_tags(db: Session) -> list[SnippetTag]:
        return db.scalars(select(SnippetTag).order_by(SnippetTag.name.asc())).all()

    @staticmethod
    def _replace_bindings(db: Session, snippet_id: int, tags: list[SnippetTag]) -> None:
        db.query(SnippetTagBinding).filter(SnippetTagBinding.snippet_id == snippet_id).delete()
        for tag in tags:
            db.add(SnippetTagBinding(snippet_id=snippet_id, tag_id=tag.id))

    def create_snippet(
        self,
        db: Session,
        title: str,
        description: str,
        language: str,
        code_content: str,
        folder_id: int | None,
        tags: list[str],
        is_public: bool,
    ) -> Snippet:
        if folder_id is not None:
            folder = db.scalar(select(SnippetFolder).where(SnippetFolder.id == folder_id))
            if folder is None:
                raise LookupError("分组不存在")

        detected, _ = SnippetService._resolve_lexer(language, code_content)
        snippet = Snippet(
            title=title.strip(),
            description=description.strip(),
            language=SnippetService._normalize_language(language),
            detected_language=detected,
            content_path="",
            content_size=0,
            content_hash="",
            code_content="",
            folder_id=folder_id,
            is_public=is_public,
        )
        db.add(snippet)
        db.flush()

        content_path, content_size, content_hash = self._write_content(int(snippet.id), code_content)
        snippet.content_path = content_path
        snippet.content_size = content_size
        snippet.content_hash = content_hash

        tag_entities = SnippetService._upsert_tags(db, tags)
        SnippetService._replace_bindings(db, snippet.id, tag_entities)

        db.commit()
        db.refresh(snippet)
        return snippet

    def update_snippet(
        self,
        db: Session,
        snippet_id: int,
        title: str,
        description: str,
        language: str,
        code_content: str,
        folder_id: int | None,
        tags: list[str],
        is_public: bool,
    ) -> Snippet:
        snippet = db.scalar(select(Snippet).where(Snippet.id == snippet_id, Snippet.is_deleted.is_(False)))
        if snippet is None:
            raise LookupError("代码片不存在")

        if folder_id is not None:
            folder = db.scalar(select(SnippetFolder).where(SnippetFolder.id == folder_id))
            if folder is None:
                raise LookupError("分组不存在")

        detected, _ = SnippetService._resolve_lexer(language, code_content)
        snippet.title = title.strip()
        snippet.description = description.strip()
        snippet.language = SnippetService._normalize_language(language)
        snippet.detected_language = detected
        snippet.folder_id = folder_id
        snippet.is_public = is_public

        old_content_path = str(snippet.content_path or "")
        content_path, content_size, content_hash = self._write_content(int(snippet.id), code_content)
        snippet.content_path = content_path
        snippet.content_size = content_size
        snippet.content_hash = content_hash
        snippet.code_content = ""

        tag_entities = SnippetService._upsert_tags(db, tags)
        SnippetService._replace_bindings(db, snippet.id, tag_entities)

        db.commit()
        db.refresh(snippet)
        if old_content_path and old_content_path != content_path:
            self._delete_content_file(old_content_path)
        return snippet

    def delete_snippet(self, db: Session, snippet_id: int) -> None:
        snippet = db.scalar(select(Snippet).where(Snippet.id == snippet_id, Snippet.is_deleted.is_(False)))
        if snippet is None:
            raise LookupError("代码片不存在")
        self._delete_content_file(str(snippet.content_path or ""))
        snippet.content_path = ""
        snippet.content_size = 0
        snippet.content_hash = ""
        snippet.code_content = ""
        snippet.is_deleted = True
        db.commit()

    @staticmethod
    def _snippet_tags_map(db: Session, snippet_ids: list[int]) -> dict[int, list[str]]:
        if not snippet_ids:
            return {}
        rows = db.execute(
            select(SnippetTagBinding.snippet_id, SnippetTag.name)
            .join(SnippetTag, SnippetTag.id == SnippetTagBinding.tag_id)
            .where(SnippetTagBinding.snippet_id.in_(snippet_ids))
            .order_by(SnippetTag.name.asc())
        ).all()
        result: dict[int, list[str]] = {}
        for snippet_id, tag_name in rows:
            result.setdefault(int(snippet_id), []).append(str(tag_name))
        return result

    @staticmethod
    def list_snippets(
        db: Session,
        query: str,
        language: str,
        folder_id: int | None,
        tag: str,
    ) -> list[Snippet]:
        stmt = select(Snippet).where(Snippet.is_deleted.is_(False))

        normalized_query = query.strip()
        if normalized_query:
            like = f"%{normalized_query}%"
            stmt = stmt.where(or_(Snippet.title.ilike(like), Snippet.description.ilike(like)))

        normalized_language = language.strip().lower()
        if normalized_language and normalized_language != "all":
            stmt = stmt.where(or_(Snippet.language == normalized_language, Snippet.detected_language == normalized_language))

        if folder_id is not None:
            stmt = stmt.where(Snippet.folder_id == folder_id)

        snippets = db.scalars(stmt.order_by(Snippet.updated_at.desc())).all()

        normalized_tag = tag.strip().lower()
        if not normalized_tag:
            return snippets

        if not snippets:
            return []

        snippet_ids = [int(item.id) for item in snippets]
        rows = db.execute(
            select(SnippetTagBinding.snippet_id)
            .join(SnippetTag, SnippetTag.id == SnippetTagBinding.tag_id)
            .where(SnippetTagBinding.snippet_id.in_(snippet_ids), SnippetTag.name == normalized_tag)
        ).all()
        allowed_ids = {int(row[0]) for row in rows}
        return [item for item in snippets if int(item.id) in allowed_ids]

    @staticmethod
    def get_snippet(db: Session, snippet_id: int) -> Snippet:
        snippet = db.scalar(select(Snippet).where(Snippet.id == snippet_id, Snippet.is_deleted.is_(False)))
        if snippet is None:
            raise LookupError("代码片不存在")
        return snippet

    @staticmethod
    def _new_share_code(db: Session) -> str:
        while True:
            code = generate_short_code(10)
            exists = db.scalar(select(SnippetShare.id).where(SnippetShare.share_code == code))
            if exists is None:
                return code

    @staticmethod
    def create_share(
        db: Session,
        snippet_id: int,
        password: str,
        expires_minutes: int | None,
        max_access_count: int | None,
        is_one_time: bool,
    ) -> SnippetShare:
        snippet = db.scalar(select(Snippet).where(Snippet.id == snippet_id, Snippet.is_deleted.is_(False)))
        if snippet is None:
            raise LookupError("代码片不存在")

        expires_at = None
        if expires_minutes is not None and expires_minutes > 0:
            expires_at = utc_now_naive() + timedelta(minutes=expires_minutes)

        share = SnippetShare(
            snippet_id=snippet_id,
            share_code=SnippetService._new_share_code(db),
            password_hash=SnippetService._hash_password(password),
            expires_at=expires_at,
            max_access_count=max_access_count,
            access_count=0,
            is_one_time=is_one_time,
            is_active=True,
        )
        db.add(share)
        db.commit()
        db.refresh(share)
        return share

    @staticmethod
    def list_shares(db: Session) -> list[tuple[SnippetShare, Snippet]]:
        now = utc_now_naive()
        rows = db.execute(
            select(SnippetShare, Snippet)
            .join(Snippet, Snippet.id == SnippetShare.snippet_id)
            .where(
                Snippet.is_deleted.is_(False),
                SnippetShare.is_active.is_(True),
                or_(SnippetShare.expires_at.is_(None), SnippetShare.expires_at >= now),
            )
            .order_by(SnippetShare.created_at.desc())
        ).all()
        return [(row[0], row[1]) for row in rows]

    @staticmethod
    def cleanup_expired_shares(db: Session) -> int:
        now = utc_now_naive()
        expired = db.scalars(
            select(SnippetShare).where(
                SnippetShare.is_active.is_(True),
                SnippetShare.expires_at.is_not(None),
                SnippetShare.expires_at < now,
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
        share = db.scalar(select(SnippetShare).where(SnippetShare.id == share_id))
        if share is None:
            raise LookupError("分享记录不存在")
        share.is_active = False
        db.commit()

    @staticmethod
    def _check_share_valid(share: SnippetShare, password: str) -> None:
        if not share.is_active:
            raise LookupError("分享不存在或已关闭")

        if share.expires_at is not None and share.expires_at < utc_now_naive():
            raise PermissionError("分享已过期")

        if share.max_access_count is not None and share.access_count >= share.max_access_count:
            raise PermissionError("分享访问次数已用尽")

        if share.password_hash and share.password_hash != SnippetService._hash_password(password):
            raise PermissionError("分享密码错误")

    @staticmethod
    def access_share(db: Session, share_code: str, password: str) -> tuple[SnippetShare, Snippet]:
        share = db.scalar(select(SnippetShare).where(SnippetShare.share_code == share_code))
        if share is None:
            raise LookupError("分享不存在")

        snippet = db.scalar(select(Snippet).where(Snippet.id == share.snippet_id, Snippet.is_deleted.is_(False)))
        if snippet is None:
            raise LookupError("代码片不存在")

        SnippetService._check_share_valid(share, password)

        share.access_count = int(share.access_count or 0) + 1
        share.last_accessed_at = utc_now_naive()
        if share.is_one_time:
            share.is_active = False
        if share.max_access_count is not None and share.access_count >= share.max_access_count:
            share.is_active = False

        db.commit()
        db.refresh(share)
        return share, snippet

    @staticmethod
    def build_download_file_name(snippet: Snippet) -> str:
        language = (snippet.language or "").strip().lower()
        detected = (snippet.detected_language or "").strip().lower()
        resolved = language if language and language != "auto" else detected

        extension_map = {
            "python": "py",
            "javascript": "js",
            "typescript": "ts",
            "java": "java",
            "go": "go",
            "rust": "rs",
            "c": "c",
            "cpp": "cpp",
            "csharp": "cs",
            "php": "php",
            "ruby": "rb",
            "kotlin": "kt",
            "swift": "swift",
            "sql": "sql",
            "bash": "sh",
            "shell": "sh",
            "zsh": "sh",
            "json": "json",
            "yaml": "yaml",
            "yml": "yml",
            "markdown": "md",
            "md": "md",
            "html": "html",
            "css": "css",
            "text": "txt",
            "plaintext": "txt",
        }
        ext = extension_map.get(resolved, "txt")
        base = (snippet.title or f"snippet-{snippet.id}").strip()
        if not base:
            base = f"snippet-{snippet.id}"
        if not base.lower().endswith(f".{ext}"):
            return f"{base}.{ext}"
        return base

    @staticmethod
    def escape_plain_preview(code_content: str) -> str:
        lines = code_content.splitlines() or [""]
        rows = []
        for index, line in enumerate(lines, start=1):
            rows.append(f"<span class='line-number'>{index:>4}</span> <span class='line-content'>{escape(line)}</span>")
        return "<pre class='snippet-fallback'>" + "\n".join(rows) + "</pre>"

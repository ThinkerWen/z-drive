<p align="center">
	<img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/z-drive.png" width="220" alt="z-drive logo" />
</p>

<h1 align="center">Z-Drive</h1>

<p align="center">A modern personal cloud platform: Gallery + Cloud + Paste</p>

<p align="center"><a href="README.md">中文</a> | English</p>

<p align="center">
	<a href="https://zdrive.404fix.cn"><img src="https://img.shields.io/badge/docs-online-0ea5e9?style=for-the-badge" alt="docs" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/issues"><img src="https://img.shields.io/badge/issues-welcome-22c55e?style=for-the-badge" alt="issues" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/stargazers"><img src="https://img.shields.io/github/stars/ThinkerWen/z-drive?style=for-the-badge" alt="stars" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ThinkerWen/z-drive?style=for-the-badge" alt="license" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/commits/main"><img src="https://img.shields.io/github/last-commit/ThinkerWen/z-drive?style=for-the-badge" alt="last-commit" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/releases"><img src="https://img.shields.io/github/v/release/ThinkerWen/z-drive?style=for-the-badge" alt="release" /></a>
	<img src="https://img.shields.io/badge/FastAPI-Backend-111827?style=for-the-badge" alt="fastapi" />
	<img src="https://img.shields.io/badge/React-Frontend-111827?style=for-the-badge" alt="react" />
</p>

---

## Highlights

- Gallery (✅)
	- Upload, management, statistics, short-link access and preview
	- Supports global / isolated permission modes
- Cloud (✅)
	- Upload, file management, share management, statistics
	- Supports folder hierarchy, file preview, batch operations and share downloads
- Snippets (✅)
	- Online editing, live preview, tag filtering, share management and statistics
	- Supports password, expiration time, access count and one-time sharing

## UI Preview

### Gallery

| Upload | List | Stats |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-upload.png" width="500" alt="gallery-upload" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-list.png" width="500" alt="gallery-list" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-stats.png" width="500" alt="gallery-stats" /> |

### Cloud

| List | Preview | Share |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-list.png" width="500" alt="cloud-list" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-preview.png" width="500" alt="cloud-preview" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-share.png" width="500" alt="cloud-share" /> |

### Snippets

| Editor | List | Share |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/snippet-editor.png" width="500" alt="snippet-editor" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/snippet-list.png" width="500" alt="snippet-list" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/snippet-preview.png" width="500" alt="snippet-preview" /> |

## Quick Start

### Local Run

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
cp .env.example .env
uv sync
cd web
pnpm install
pnpm build
cd ..
uv run z-drive
```

Optional timezone config: set `APP_TIMEZONE` in `.env` (for example `Asia/Shanghai`, `UTC`, or `Asia/Tokyo`). API datetime strings will be formatted using this timezone.

### Docker Run

```bash
cp .env.example .env
docker compose up -d
```

## Full Documentation

- Online docs: https://zdrive.404fix.cn

## Feedback

- Issue: https://github.com/ThinkerWen/z-drive/issues
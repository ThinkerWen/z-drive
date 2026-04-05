# z-drive

[中文](README.md) | English

## 1. Feature Overview

z-drive is a personal cloud project focused on image hosting, cloud drive, and code snippet sharing, using FastAPI as the backend.

- Image Hosting (✅)
	- Upload, management, analytics, short-link access, and preview
	- Supports both global and per-item access control modes
- Cloud Drive (✅)
	- Upload, file management, share management, and analytics
	- Supports folder hierarchy, file preview, batch operations, and share-based download
- Code Snippet Sharing (To-Do)
	- Text/code snippet hosting and sharing
	- Planned support for global/per-item access control and preview

## 2. UI Preview

### 1. Gallery

| Upload | List | Stats |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-upload.png" width="500" alt="gallery-upload"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-list.png" width="500" alt="gallery-list"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-stats.png" width="500" alt="gallery-stats"> |

### 2. Cloud

| File List | Preview | Share |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-list.png" width="500" alt="cloud-list"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-preview.png" width="500" alt="cloud-preview"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-share.png" width="500" alt="cloud-share"> |

## 3. Installation Guide

### 1. Local (Production)

1. Clone and enter the project directory

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. Create the environment file

```bash
cp .env.example .env
```

3. Install dependencies and build frontend

```bash
uv sync
cd web
pnpm install
pnpm build
```

4. Start backend (production)

```bash
uv run z-drive
```

### 2. Docker (Recommended)

1. Clone and enter the project directory

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. Configure environment values as needed (recommended)

```bash
cp .env.example .env
```

3. Start with Docker Compose

```bash
docker compose up -d
```

Notes:
- The sample compose file is `docker-compose.yml` in the project root.
- If you use custom image owner/tag, set `DOCKERHUB_USERNAME` and `ZDRIVE_TAG` first.

## 4. `.env` Fields

| Field | Description | Default |
| --- | --- | --- |
| `APP_NAME` | Application name | `z-drive` |
| `DEBUG` | Enable debug mode | `false` |
| `DATABASE_URL` | Database connection string | `sqlite:///./z_drive.db` |
| `STORAGE_PATH` | Local file storage directory | `storage` |
| `VIEW_ORIGIN` | Always return original file instead of preview | `false` |
| `ENABLE_BROWSER_CACHE` | Enable browser cache headers | `true` |
| `IMAGE_MAX_FILE_SIZE_MB` | Max upload size per file (MB) | `50` |
| `CLOUD_TOTAL_SPACE_MB` | Total cloud drive quota (MB) | `10240` |
| `IMAGE_AUTH_MODE` | Image access mode (e.g. `none`/`sign`) | `none` |
| `SIGN_SALT` | Global signature salt (must be replaced) | `replace-with-random-salt` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password (must be replaced) | `replace-with-strong-password` |
| `JWT_SECRET` | JWT secret (must be replaced, at least 32 bytes) | `replace-with-long-random-secret-at-least-32-bytes` |
| `JWT_EXPIRE_MINUTES` | Admin session expiration in minutes | `10080` |

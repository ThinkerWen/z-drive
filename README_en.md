# z-drive

[中文](README.md) | English

## 1. Feature Overview

z-drive is a personal cloud project focused on image hosting, cloud drive, and code snippet sharing, using FastAPI as the backend.

- Image Hosting (Implemented)
	- Upload, management, analytics, short-link access, and preview
	- Supports both global and per-item access control modes
- Cloud Drive (To-Do)
	- Personal file management and preview
	- Planned support for global/per-item access control
- Code Snippet Sharing (To-Do)
	- Text/code snippet hosting and sharing
	- Planned support for global/per-item access control and preview

## 2. Installation Guide

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

## 3. `.env` Fields

| Field | Description | Default |
| --- | --- | --- |
| `APP_NAME` | Application name | `z-drive` |
| `DEBUG` | Enable debug mode | `false` |
| `DATABASE_URL` | Database connection string | `sqlite:///./z_drive.db` |
| `STORAGE_PATH` | Local file storage directory | `storage` |
| `VIEW_ORIGIN` | Always return original file instead of preview | `false` |
| `ENABLE_BROWSER_CACHE` | Enable browser cache headers | `true` |
| `IMAGE_MAX_FILE_SIZE_MB` | Max upload size per file (MB) | `50` |
| `IMAGE_AUTH_MODE` | Image access mode (e.g. `none`/`sign`) | `none` |
| `SIGN_SALT` | Global signature salt (must be replaced) | `change-me` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password (must be replaced) | `admin123` |
| `JWT_SECRET` | JWT secret (must be replaced, at least 32 bytes) | `z-drive-change-me-secret-key-at-least-32-bytes` |
| `JWT_EXPIRE_MINUTES` | Admin session expiration in minutes | `10080` |

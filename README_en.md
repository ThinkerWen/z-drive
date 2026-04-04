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

1. Clone and enter the project directory

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. Create the environment file

```bash
cp .env.example .env
```

3. Start backend

```bash
uv sync
uv run python main.py
```

or:

```bash
uv run uvicorn app.main:app --reload
```

4. Start frontend development (optional)

```bash
cd web
pnpm install
pnpm dev
```

5. Build frontend (production)

```bash
cd web
pnpm build
```

## 3. `.env` Fields

| Field | Description | Default |
| --- | --- | --- |
| `APP_NAME` | Application name | `z-drive` |
| `DEBUG` | Enable debug mode | `false` |
| `BASE_URL` | Public service URL used for generating full links | `http://127.0.0.1:8000` |
| `DATABASE_URL` | Database connection string | `sqlite:///./z_drive.db` |
| `STORAGE_PATH` | Local file storage directory | `storage` |
| `VIEW_ORIGIN` | Always return original file instead of preview | `false` |
| `ENABLE_BROWSER_CACHE` | Enable browser cache headers | `true` |
| `IMAGE_MAX_FILE_SIZE_MB` | Max upload size per file (MB) | `50` |
| `IMAGE_THUMBNAIL_SIZE` | Thumbnail size config (reserved) | `320` |
| `IMAGE_AUTH_MODE` | Image access mode (e.g. `none`/`sign`) | `none` |
| `SIGN_SALT` | Global signature salt (must be replaced) | `change-me` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `ADMIN_PASSWORD` | Admin password (must be replaced) | `admin123` |
| `JWT_SECRET` | JWT secret (must be replaced, at least 32 bytes) | `z-drive-change-me-secret-key-at-least-32-bytes` |
| `JWT_EXPIRE_MINUTES` | Admin session expiration in minutes | `10080` |

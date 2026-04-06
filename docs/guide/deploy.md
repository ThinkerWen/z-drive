# 部署说明

本文先给出一套可以直接复制的部署文件，再说明每一项的含义。当前仓库默认使用 SQLite + 本地磁盘挂载，适合单机或小型服务器。

## Docker Compose

```yaml
version: "3.9"

services:
  z-drive:
    image: designerwang/z-drive:latest
    container_name: z-drive
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      APP_NAME: z-drive
      DEBUG: "false"
      DATABASE_URL: sqlite:////data/storage/z_drive.db
      STORAGE_PATH: /data/storage
      VIEW_ORIGIN: "false"
      ENABLE_BROWSER_CACHE: "true"
      IMAGE_MAX_FILE_SIZE_MB: "50"
      IMAGE_AUTH_MODE: none
      SIGN_SALT: ${SIGN_SALT:-change-me}
      ADMIN_USERNAME: ${ADMIN_USERNAME:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-change-me}
      ADMIN_TOKEN: ${ADMIN_TOKEN:-z-drive-change-me-admin-token}
      JWT_SECRET: ${JWT_SECRET:-z-drive-change-me-secret-key-at-least-32-bytes}
      JWT_EXPIRE_MINUTES: ${JWT_EXPIRE_MINUTES:-10080}
    volumes:
      - ./storage:/data/storage
```

### 对应 `.env`

```bash
# z-drive runtime settings
# Copy to .env and replace sensitive values before production use.

APP_NAME=z-drive
DEBUG=false

DATABASE_URL=sqlite:///./storage/z_drive.db
STORAGE_PATH=storage

VIEW_ORIGIN=false
ENABLE_BROWSER_CACHE=true
IMAGE_MAX_FILE_SIZE_MB=50
CLOUD_TOTAL_SPACE_MB=10240
IMAGE_AUTH_MODE=none
SIGN_SALT=replace-with-random-salt

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-strong-password
ADMIN_TOKEN=replace-with-long-random-admin-token
JWT_SECRET=replace-with-long-random-secret-at-least-32-bytes
JWT_EXPIRE_MINUTES=10080
```

### 启动步骤

```bash
cp .env.example .env
docker compose up -d
```

如果你使用上面的 Compose 示例，首次启动前需要先创建本地存储目录：

```bash
mkdir -p storage
```

## 本地运行

如果你不是直接用 Docker，也可以在本机运行：

```bash
cp .env.example .env
uv sync
cd web
pnpm install
pnpm build
cd ..
uv run z-drive
```

默认访问地址：

- 管理端：`http://127.0.0.1:8000/`
- 健康检查：`http://127.0.0.1:8000/health`

## 部署建议

- 生产环境下请务必修改 `.env` 里的 `ADMIN_PASSWORD`、`JWT_SECRET` 和 `SIGN_SALT`。
- 如果你需要静态令牌访问，把 `.env` 里的 `ADMIN_TOKEN` 也改成随机长字符串；Compose 示例中的默认占位值是 `z-drive-change-me-admin-token`，`.env.example` 示例值是 `replace-with-long-random-admin-token`。
- 如果你希望保留上传文件和数据库，记得把 `./storage` 目录持久化到宿主机或云盘卷。
- 如果是反向代理部署，建议在代理层开启 HTTPS，并把请求头中的真实客户端 IP 透传给后端。
- 如果你不想暴露 Swagger / OpenAPI，把 `.env` 里的 `DEBUG` 保持为 `false`；只有 `DEBUG=true` 时，`/docs`、`/redoc` 和 `/openapi.json` 才会开放。

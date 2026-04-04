# z-drive

中文 | [English](README_en.md)

## 一、功能介绍

z-drive 是一个专注个人云项目，包含图床、云盘、代码片等云功能，使用 FastAPI 作为后端。

- 图床（已实现）
	- 上传、管理、统计、短链访问与预览
	- 支持全局/独立两种权限管理模式
- 云盘（To-Do）
	- 面向个人文件管理与预览
	- 规划支持全局/独立权限管理
- 代码片分享（To-Do）
	- 面向文本/代码片段托管与分享
	- 规划支持全局/独立权限管理与预览

## 二、安装指导

### 1、本地运行

1. 克隆并进入项目目录

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. 创建环境变量文件

```bash
cp .env.example .env
```

3. 启动后端

```bash
uv sync
uv run python main.py
```

或：

```bash
uv run uvicorn app.main:app --reload
```

4. 启动前端开发（可选）

```bash
cd web
pnpm install
pnpm dev
```

5. 前端构建（生产）

```bash
cd web
pnpm build
```

### 2、Docker（推荐）

1. 克隆并进入项目目录

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. 按需配置环境变量（建议）

```bash
cp .env.example .env
```

3. 使用 Docker Compose 启动

```bash
docker compose up -d
```

说明：
- 示例编排文件为项目根目录下的 `docker-compose.yml`
- 如果使用私有镜像或自定义 tag，请先设置 `DOCKERHUB_USERNAME` 和 `ZDRIVE_TAG`

## 三、`.env` 字段介绍

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_NAME` | 应用名称 | `z-drive` |
| `DEBUG` | 是否开启调试模式 | `false` |
| `BASE_URL` | 服务对外访问地址（用于生成完整链接） | `http://127.0.0.1:8000` |
| `DATABASE_URL` | 数据库连接串 | `sqlite:///./z_drive.db` |
| `STORAGE_PATH` | 本地文件存储目录 | `storage` |
| `VIEW_ORIGIN` | 是否始终返回原图而非预览图 | `false` |
| `ENABLE_BROWSER_CACHE` | 是否启用浏览器缓存头 | `true` |
| `IMAGE_MAX_FILE_SIZE_MB` | 单文件上传大小上限（MB） | `50` |
| `IMAGE_THUMBNAIL_SIZE` | 缩略图尺寸配置（预留） | `320` |
| `IMAGE_AUTH_MODE` | 图片访问权限模式（如 `none`/`sign`） | `none` |
| `SIGN_SALT` | 全局签名盐值（务必替换） | `change-me` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码（务必替换） | `admin123` |
| `JWT_SECRET` | JWT 密钥（务必替换且不少于 32 字节） | `z-drive-change-me-secret-key-at-least-32-bytes` |
| `JWT_EXPIRE_MINUTES` | 管理员登录态过期时间（分钟） | `10080` |
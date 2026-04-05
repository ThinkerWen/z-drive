# z-drive

中文 | [English](README_en.md)

## 一、功能介绍

z-drive 是一个专注个人云项目，包含图床、云盘、代码片等云功能，使用 FastAPI 作为后端。

- 图床（✅）
	- 上传、管理、统计、短链访问与预览
	- 支持全局/独立两种权限管理模式
- 云盘（✅）
	- 上传、文件管理、分享管理、数据统计
	- 支持目录层级、批量操作、分享下载
- 代码片分享（To-do）
	- 面向文本/代码片段托管与分享
	- 规划支持全局/独立权限管理与预览

## 二、界面预览

### 1. 图库页面

| 上传页 | 列表页 | 统计页                                                                                                                         |
| --- | --- |-----------------------------------------------------------------------------------------------------------------------------|
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-upload.png" width="500" alt="z-drive.png"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-list.png" width="500" alt="z-drive.png"> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-stats.png" width="500" alt="z-drive.png"> |

### 2. 云盘页面

| 上传页                                                                                                                                  |
|--------------------------------------------------------------------------------------------------------------------------------------|
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-list.png" width="500" alt="z-drive.png"> |

## 三、安装指导

### 1、本地生产运行

1. 克隆并进入项目目录

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. 创建环境变量文件

```bash
cp .env.example .env
```

3. 安装依赖并构建前端

```bash
uv sync
cd web
pnpm install
pnpm build
```

4. 启动后端（生产）

```bash
uv run z-drive
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

## 四、`.env` 字段介绍

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `APP_NAME` | 应用名称 | `z-drive` |
| `DEBUG` | 是否开启调试模式 | `false` |
| `DATABASE_URL` | 数据库连接串 | `sqlite:///./z_drive.db` |
| `STORAGE_PATH` | 本地文件存储目录 | `storage` |
| `VIEW_ORIGIN` | 是否始终返回原图而非预览图 | `false` |
| `ENABLE_BROWSER_CACHE` | 是否启用浏览器缓存头 | `true` |
| `IMAGE_MAX_FILE_SIZE_MB` | 单文件上传大小上限（MB） | `50` |
| `CLOUD_TOTAL_SPACE_MB` | 云盘总空间上限（MB） | `10240` |
| `IMAGE_AUTH_MODE` | 图片访问权限模式（如 `none`/`sign`） | `none` |
| `SIGN_SALT` | 全局签名盐值（务必替换） | `replace-with-random-salt` |
| `ADMIN_USERNAME` | 管理员用户名 | `admin` |
| `ADMIN_PASSWORD` | 管理员密码（务必替换） | `replace-with-strong-password` |
| `JWT_SECRET` | JWT 密钥（务必替换且不少于 32 字节） | `replace-with-long-random-secret-at-least-32-bytes` |
| `JWT_EXPIRE_MINUTES` | 管理员登录态过期时间（分钟） | `10080` |
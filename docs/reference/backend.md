# 后端与模型

本页说明后端模块的职责、数据流和存储约定，帮助你快速定位实现代码。

## 入口与生命周期

- `app/main.py`：应用入口，负责创建 `FastAPI` 实例、挂载静态资源、注册路由、启动定时任务以及请求日志中间件。
- 启动时会执行数据库初始化，并创建图库、云盘和分片上传需要的目录。
- `app.state.settings` 会保存运行配置，便于路由和中间件读取。

## 模块分工

| 模块 | 职责 |
| --- | --- |
| `app/api/routes/health.py` | 健康检查。 |
| `app/api/routes/gallery.py` | 图库上传、访问、登录、统计和后台管理。 |
| `app/api/routes/cloud.py` | 云盘文件管理、分享、公共访问、分片上传和统计。 |
| `app/api/routes/frontend.py` | 静态前端入口路由。 |
| `app/core/security.py` | 管理端鉴权、JWT / 静态令牌解析。 |
| `app/core/corn.py` | 定时任务调度，负责同步图库预览与清理过期分享。 |
| `app/services/gallery.py` | 图库文件存储、预览生成、统计与访问控制。 |
| `app/services/cloud.py` | 云盘文件和目录操作。 |
| `app/services/cloud_share.py` | 分享创建、校验、过期处理与访问记录。 |
| `app/services/cloud_chunk_upload.py` | 分片上传任务管理与合并。 |
| `app/models/` | SQLAlchemy ORM 模型。 |
| `app/schemas/` | 请求和响应结构。 |
| `app/core/config.py` | 环境变量与默认配置。 |

## 存储结构

当前代码的存储路径约定如下：

- `storage/gallery/original/`：图库原始文件。
- `storage/gallery/preview/`：图库预览图。
- `storage/cloud/`：云盘文件。
- `storage/cloud/.uploads/`：分片上传临时文件与任务元数据。
- `storage/`：根存储目录，可通过 `STORAGE_PATH` 调整。

图库服务还保留了旧路径兼容逻辑，会自动迁移或回读 `storage/original/` 和 `storage/preview/`，避免升级后旧数据失效。

## 图库处理流程

1. 上传文件后先计算大小、类型和 MIME。
2. 图片会尝试生成 WebP 预览图，云盘上传则按异步补齐策略维护预览文件。
3. 元数据写入数据库，包括短链、文件名、尺寸、访问模式和统计信息。
4. 访问图片时会先校验权限，再按 `VIEW_ORIGIN` 决定返回原图还是预览。

## 云盘处理流程

1. 云盘文件存储在 `storage/cloud` 下。
2. 文件管理支持上传、重命名、移动、复制、删除与批量操作，并提供目录层级导航和右键菜单。
3. 分享功能会生成分享码，并支持密码、过期时间和短链 `/f/{share_code}`。
4. 分片上传会先初始化任务，再逐片上传，最后合并并保存为正式文件。
5. 定时任务会清理过期分享，并同步图库缺失的预览文件。

## 权限模型

- 图库管理端依赖管理员 JWT 登录态，必要时也可通过静态 `ADMIN_TOKEN` 访问。
- 公共图片访问可通过全局签名或单独签名控制。
- 云盘管理接口同样依赖管理员登录态。
- `ADMIN_TOKEN` 为空时，静态令牌通道会自动关闭。

## 统计项

图库和云盘都提供统计接口：

- 图库统计：总图片数、总大小、总访问量、今日上传/访问、热门图片、来源和访问 IP 统计。
- 云盘统计：总文件数、文件夹数、总大小、总空间、可用空间、近期上传、热门访问条目和近期访问 TOP5。


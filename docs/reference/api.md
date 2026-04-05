# 接口与路由

本页按当前路由结构整理主要 API。由于项目里同时存在图库（Gallery）和云盘（Cloud），接口被分成两大部分，便于按业务查找。

## 鉴权方式

大部分管理接口都依赖管理员登录态，支持两种携带方式：

- Cookie：`z_drive_admin_token`
- Header：`Authorization: Bearer <token>`

登录后端会签发 JWT，未登录或过期时会返回 `401`。

## 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/` | 返回运行中消息。 |
| `GET` | `/health` | 健康检查接口。 |

## 图库接口

图库接口用于上传、查看、统计和管理图片资源。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/gallery/upload` | 上传单张图片或文件，表单字段包含 `file` 和 `access_mode`。 |
| `POST` | `/gallery/upload/multiple` | 批量上传多个文件。 |
| `GET` | `/gallery/list` | 分页查询图库条目，支持 `page`、`page_size`、`file_type`、`query`。 |
| `GET` | `/gallery/stats` | 查看图库统计信息。 |
| `DELETE` | `/gallery/delete/{short_code}` | 删除指定图片。 |
| `POST` | `/gallery/login` | 管理端登录并获取 token。 |
| `GET` | `/gallery/logout` | 退出登录并清除 Cookie。 |
| `GET` | `/gallery/file/{file_key}` | 获取原图文件。 |
| `GET` | `/gallery/info/{file_key}` | 获取图片元信息。 |
| `GET` | `/gallery/download/{file_key}` | 下载原图。 |
| `GET` | `/i/{file_key}` | 公开访问入口，可返回预览图或原图。 |

### 图库上传示例

```bash
curl -X POST "http://127.0.0.1:8000/gallery/upload" \
	-F "file=@./demo.jpg" \
	-F "access_mode=none"
```

### 图库访问说明

- `access_mode=none`：不启用单独密码。
- `access_mode=individual`：会生成独立访问签名。
- `IMAGE_AUTH_MODE=sign` 时，会使用全局签名控制访问。

## 云盘接口

云盘接口用于文件管理、目录操作、批量处理、分享和分片上传。

### 管理接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/cloud/items` | 列出目录下文件，支持排序和筛选。 |
| `POST` | `/cloud/folders` | 新建文件夹。 |
| `POST` | `/cloud/upload` | 上传单个文件。 |
| `POST` | `/cloud/upload/multiple` | 批量上传文件。 |
| `POST` | `/cloud/uploads/fast-check` | 秒传检查。 |
| `POST` | `/cloud/uploads/fast-save` | 直接保存已存在文件。 |
| `PATCH` | `/cloud/items/{item_id}` | 重命名文件或目录。 |
| `POST` | `/cloud/items/{item_id}/move` | 移动文件或目录。 |
| `POST` | `/cloud/items/{item_id}/copy` | 复制文件或目录。 |
| `PATCH` | `/cloud/items/{item_id}/visibility` | 切换可见性。 |
| `DELETE` | `/cloud/items/{item_id}` | 删除条目。 |
| `POST` | `/cloud/items/batch/delete` | 批量删除。 |
| `POST` | `/cloud/items/batch/move` | 批量移动。 |
| `POST` | `/cloud/items/batch/copy` | 批量复制。 |
| `GET` | `/cloud/download/{item_id}` | 下载文件。 |
| `GET` | `/cloud/preview/{item_id}` | 预览文件。 |
| `GET` | `/cloud/thumbnail/{item_id}` | 获取缩略图。 |
| `POST` | `/cloud/items/batch/download` | 批量打包下载。 |
| `GET` | `/cloud/summary` | 云盘统计摘要。 |

### 分享接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/cloud/shares` | 创建分享。 |
| `GET` | `/cloud/shares` | 列出分享。 |
| `DELETE` | `/cloud/shares/{share_id}` | 取消分享。 |
| `GET` | `/cloud/shares/{share_id}/logs` | 查看访问日志。 |
| `POST` | `/cloud/public/{share_code}/access` | 公开分享访问入口，返回预览和下载地址。 |
| `GET` | `/cloud/public/{share_code}/preview` | 分享预览。 |
| `GET` | `/cloud/public/{share_code}/download` | 分享下载。 |
| `GET` | `/f/{share_code}` | 短链入口，可能重定向到预览页。 |

### 分片上传接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/cloud/uploads/chunk/init` | 初始化分片上传任务。 |
| `PUT` | `/cloud/uploads/chunk/{upload_id}/{index}` | 上传某个分片。 |
| `GET` | `/cloud/uploads/chunk/{upload_id}` | 查询分片上传状态。 |
| `GET` | `/cloud/uploads/tasks` | 列出所有上传任务。 |
| `POST` | `/cloud/uploads/chunk/{upload_id}/pause` | 暂停任务。 |
| `POST` | `/cloud/uploads/chunk/{upload_id}/resume` | 恢复任务。 |
| `POST` | `/cloud/uploads/chunk/{upload_id}/complete` | 合并分片并保存为正式文件。 |
| `POST` | `/cloud/uploads/chunk/{upload_id}/cancel` | 取消任务。 |

## 请求示例

### 云盘新建文件夹

```bash
curl -X POST "http://127.0.0.1:8000/cloud/folders" \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"parent_id":null,"name":"Demo"}'
```

### 创建分享

```bash
curl -X POST "http://127.0.0.1:8000/cloud/shares" \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"item_id":1,"password":"","expires_minutes":10080}'
```

## OpenAPI / Swagger

FastAPI 默认提供接口文档：

- `GET /openapi.json`
- `GET /docs`

如果你想核对字段定义，建议启动服务后直接打开 `http://127.0.0.1:8000/docs`。

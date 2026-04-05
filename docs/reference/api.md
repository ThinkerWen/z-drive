# 接口与路由

本页按当前路由结构整理主要 API。由于项目里同时存在图库（Gallery）和云盘（Cloud），接口被分成两大部分，便于按业务查找。

说明：除少量公共短链和静态访问入口外，当前管理接口统一挂载在 `/api` 前缀下。

## 鉴权方式

大部分管理接口都依赖管理员登录态，支持两种携带方式：

- Cookie：`z_drive_admin_token`
- Header：`Authorization: Bearer <token>`

登录后端会签发 JWT，未登录或过期时会返回 `401`。
如果配置了 `ADMIN_TOKEN`，也可以直接使用静态令牌；当 `ADMIN_TOKEN` 为空时，该通道会自动关闭。

## 健康检查

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/` | 返回运行中消息。 |
| `GET` | `/health` | 健康检查接口。 |

## 图库接口

图库接口用于上传、查看、统计和管理图片资源。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/gallery/upload` | 上传单张图片或文件，表单字段包含 `file` 和 `access_mode`。 |
| `POST` | `/api/gallery/upload/multiple` | 批量上传多个文件。 |
| `GET` | `/api/gallery/list` | 分页查询图库条目，支持 `page`、`page_size`、`file_type`、`query`。 |
| `GET` | `/api/gallery/stats` | 查看图库统计信息。 |
| `DELETE` | `/api/gallery/delete/{short_code}` | 删除指定图片。 |
| `POST` | `/api/gallery/login` | 管理端登录并获取 token。 |
| `GET` | `/api/gallery/logout` | 退出登录并清除 Cookie。 |
| `GET` | `/api/gallery/file/{file_key}` | 获取原图文件。 |
| `GET` | `/api/gallery/info/{file_key}` | 获取图片元信息。 |
| `GET` | `/api/gallery/download/{file_key}` | 下载原图。 |
| `GET` | `/i/{file_key}` | 公开访问入口，可返回预览图或原图。 |

### 图库上传示例

```bash
curl -X POST "http://127.0.0.1:8000/api/gallery/upload" \
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
| `GET` | `/api/cloud/items` | 列出目录下文件，支持排序和筛选。 |
| `POST` | `/api/cloud/folders` | 新建文件夹。 |
| `POST` | `/api/cloud/upload` | 上传单个文件。 |
| `POST` | `/api/cloud/upload/multiple` | 批量上传文件。 |
| `POST` | `/api/cloud/uploads/fast-check` | 秒传检查。 |
| `POST` | `/api/cloud/uploads/fast-save` | 直接保存已存在文件。 |
| `PATCH` | `/api/cloud/items/{item_id}` | 重命名文件或目录。 |
| `POST` | `/api/cloud/items/{item_id}/move` | 移动文件或目录。 |
| `POST` | `/api/cloud/items/{item_id}/copy` | 复制文件或目录。 |
| `PATCH` | `/api/cloud/items/{item_id}/visibility` | 切换可见性。 |
| `DELETE` | `/api/cloud/items/{item_id}` | 删除条目。 |
| `POST` | `/api/cloud/items/batch/delete` | 批量删除。 |
| `POST` | `/api/cloud/items/batch/move` | 批量移动。 |
| `POST` | `/api/cloud/items/batch/copy` | 批量复制。 |
| `GET` | `/api/cloud/download/{item_id}` | 下载文件。 |
| `GET` | `/api/cloud/preview/{item_id}` | 预览文件。 |
| `GET` | `/api/cloud/thumbnail/{item_id}` | 获取缩略图。 |
| `POST` | `/api/cloud/items/batch/download` | 批量打包下载。 |
| `GET` | `/api/cloud/summary` | 云盘统计摘要。 |

### 分享接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/cloud/shares` | 创建分享。 |
| `GET` | `/api/cloud/shares` | 列出分享。 |
| `DELETE` | `/api/cloud/shares/{share_id}` | 取消分享。 |
| `GET` | `/api/cloud/shares/{share_id}/logs` | 查看访问日志。 |
| `POST` | `/api/cloud/public/{share_code}/access` | 公开分享访问入口，返回预览和下载地址。 |
| `GET` | `/api/cloud/public/{share_code}/preview` | 分享预览。 |
| `GET` | `/api/cloud/public/{share_code}/download` | 分享下载。 |
| `GET` | `/f/{share_code}` | 短链入口，可能重定向到预览页。 |

### 分片上传接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/cloud/uploads/chunk/init` | 初始化分片上传任务。 |
| `PUT` | `/api/cloud/uploads/chunk/{upload_id}/{index}` | 上传某个分片。 |
| `GET` | `/api/cloud/uploads/chunk/{upload_id}` | 查询分片上传状态。 |
| `GET` | `/api/cloud/uploads/tasks` | 列出所有上传任务。 |
| `POST` | `/api/cloud/uploads/chunk/{upload_id}/pause` | 暂停任务。 |
| `POST` | `/api/cloud/uploads/chunk/{upload_id}/resume` | 恢复任务。 |
| `POST` | `/api/cloud/uploads/chunk/{upload_id}/complete` | 合并分片并保存为正式文件。 |
| `POST` | `/api/cloud/uploads/chunk/{upload_id}/cancel` | 取消任务。 |

## 代码片接口

代码片接口用于编辑、查询、分享和下载代码片内容。

### 管理接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/snippets` | 查询代码片列表，支持 `query`、`language`、`folder_id`、`tag`。 |
| `POST` | `/api/snippets` | 新建代码片。 |
| `PUT` | `/api/snippets/{snippet_id}` | 更新代码片。 |
| `DELETE` | `/api/snippets/{snippet_id}` | 删除代码片。 |
| `GET` | `/api/snippets/{snippet_id}` | 获取代码片详情。 |
| `GET` | `/api/snippets/{snippet_id}/download` | 下载代码片正文。 |
| `GET` | `/api/snippets/folders` | 列出代码片分组。 |
| `POST` | `/api/snippets/folders` | 新建代码片分组。 |
| `GET` | `/api/snippets/tags` | 列出代码片标签。 |
| `POST` | `/api/snippets/tags` | 新建代码片标签。 |
| `GET` | `/api/snippets/shares/list` | 列出有效代码片分享。 |
| `POST` | `/api/snippets/{snippet_id}/shares` | 创建代码片分享。 |
| `DELETE` | `/api/snippets/shares/{share_id}` | 取消代码片分享。 |

### 公共分享接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `POST` | `/api/snippets/public/{share_code}/access` | 公共访问代码片分享，支持密码校验。 |
| `GET` | `/api/snippets/public/{share_code}/download` | 公共下载代码片正文。 |
| `GET` | `/p/{share_code}` | 代码片短链入口。 |

## 请求示例

### 云盘新建文件夹

```bash
curl -X POST "http://127.0.0.1:8000/api/cloud/folders" \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"parent_id":null,"name":"Demo"}'
```

### 创建分享

```bash
curl -X POST "http://127.0.0.1:8000/api/cloud/shares" \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-d '{"item_id":1,"password":"","expires_minutes":10080}'
```

## OpenAPI / Swagger

FastAPI 在 `DEBUG=true` 时默认提供接口文档：

- `GET /openapi.json`
- `GET /docs`

如果你想核对字段定义，建议在本地调试环境直接打开 `http://127.0.0.1:8000/docs`。生产环境把 `DEBUG` 设为 `false` 后，这两个入口会关闭。

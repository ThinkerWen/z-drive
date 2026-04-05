# 接口与路由

本页概览后端公开的主要 HTTP 接口与使用示例（基于当前代码结构的高层说明）。若需准确的每个端点签名，请参考代码或生成的 OpenAPI 文档。

## 常用端点（示例）

- `GET /api/health` — 服务健康检测
- `POST /api/upload` — 上传文件（图片/视频/其他）
- `GET /api/gallery` — 列表/查询图库条目
- `GET /api/image/{id}` — 获取图片原始文件或预览
- `GET /s/{short_code}` — 短链访问重定向或资源预览

## 使用示例（curl）

```bash
curl -F "file=@path/to/image.jpg" https://your-host/api/upload
```

## OpenAPI / Swagger

后端使用 FastAPI，默认提供 OpenAPI JSON 与 Swagger UI，通常位于：

- `GET /openapi.json`
- `GET /docs`（Swagger UI，如果启用）

建议在本地启动服务后打开 `/openapi.json`，或使用 `uv run` 方式查看自动生成的接口说明。

# 架构与简介

本章节概述 Z-Drive 的整体架构、技术栈与主要模块。

## 技术栈

- 后端：FastAPI（Python）
- 数据库：SQLite（可替换为 Postgres 等）
- 前端：React + Vite + Tailwind
- 定时任务：schedule + asyncio 循环
- 文档：VitePress

## 模块划分

- `app/`：后端应用代码（路由、服务、模型、配置等）
- `web/`：前端源码（React）
- `docs/`：VitePress 文档站
- `storage/`：运行时文件存储（gallery / cloud / snippets）

## 运行流程（简述）

1. 前端将文件上传到后端 API，管理接口统一挂载在 `/api` 前缀下。
2. 后端存储原始文件并生成预览，图库图片会同步生成 WebP 预览，云盘会按需提供文件预览，代码片正文则写入本地文件存储。
3. 元数据入库，支持短链、分享、访问统计与管理端鉴权。
4. 定时任务每分钟执行一次，负责补齐图库预览、清理过期分享并维护同步任务。
5. 前端通过管理接口或公共入口 `/f/{share_code}`、`/i/{file_key}`、`/p/{share_code}` 访问资源。

## 鉴权模型

- 管理端支持 JWT 登录态。
- 同时支持静态 `ADMIN_TOKEN`，便于自动化或外部系统接入。
- 如果 `ADMIN_TOKEN` 为空，则静态令牌通道会自动关闭。

## 目录约定

- `storage/gallery/original/`：图库原始文件。
- `storage/gallery/preview/`：图库预览图。
- `storage/cloud/`：云盘文件。
- `storage/cloud/.uploads/`：分片上传临时文件与任务元数据。
- `storage/snippets/`：代码片正文文件。
- 旧的 `storage/original/` 与 `storage/preview/` 仍保留兼容读取逻辑，便于历史数据平滑迁移。

更多细节见下游各章节（后端、接口、配置）。

# 架构与简介

本章节概述 Z-Drive 的整体架构、技术栈与主要模块。

## 技术栈

- 后端：FastAPI（Python）
- 数据库：SQLite（可替换为 Postgres 等）
- 前端：React + Vite + Tailwind
- 文档：VitePress

## 模块划分

- `app/`：后端应用代码（路由、服务、模型、配置等）
- `web/`：前端源码（React）
- `docs/`：VitePress 文档站
- `storage/`：运行时文件存储（original / preview / thumbnail / gallery）

## 运行流程（简述）

1. 前端将文件上传到后端 API。
2. 后端存储原始文件并生成预览（图片缩略、视频预览等）。
3. 元数据入库，支持短链与分享功能。
4. 前端通过短链或鉴权接口访问资源。

更多细节见下游各章节（后端、接口、配置）。

# 配置项说明

本篇整理仓库中常见的环境变量与可配置项（以 `.env.example` 与 `app/core/config.py` 为准）。

## 常见配置

- `DATABASE_URL` — 数据库连接（默认 SQLite 可用 `sqlite:///./zdrive.db`）
- `CLOUD_TOTAL_SPACE_MB` — 本实例总可用空间（MB），用于配额统计
- `SECRET_KEY` — 用于签名与会话的密钥
- `STORAGE_ROOT` — 存储根目录（默认 `storage/`）

请参阅仓库根目录的 `.env.example` 以获取完整示例。

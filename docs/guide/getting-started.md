# 快速开始

## 环境要求

- Python 3.10+
- Node.js 18+
- pnpm

## 本地运行

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
cp .env.example .env
uv sync
cd web
pnpm install
pnpm build
cd ..
uv run z-drive
```

默认访问：

- 管理台: http://127.0.0.1:8000/

# 部署说明

## Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

## 文档站部署（GitHub Pages）

当前仓库已提供 `docs-pages.yml` 工作流：

- 触发分支：`doc`
- 构建目录：`docs/.vitepress/dist`
- 发布目标：GitHub Pages

首次启用请在仓库设置中确认：

1. 打开 `Settings` -> `Pages`
2. `Build and deployment` 选择 `GitHub Actions`

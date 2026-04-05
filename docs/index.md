---
layout: Home
---

# Z-Drive

<p align="center">
	<img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/z-drive.png" alt="Z-Drive" width="220" />
</p>

个人云平台（图库 + 云盘）的轻量实现，面向个人备份、分享与小型团队使用。

## 快速导航

- **开始使用**：[快速开始](/guide/getting-started)
- **部署指南**：[部署说明](/guide/deploy)
- **API 参考**：[接口与路由](/reference/api)
- **架构与后端**：[后端与模型说明](/reference/backend)

---

## 项目亮点

- 简洁的图库与云盘功能：上传、预览、短链分享
- 现代化栈：FastAPI（后端）、React + Vite（前端）
- 可用的 CI/CD 文档站部署到 GitHub Pages

---

## 快速开始

1. 克隆仓库并进入：

```bash
git clone https://github.com/ThinkerWen/z-drive.git
cd z-drive
```

2. 后端启动（示例）：

```bash
cp .env.example .env
uv sync
uv run z-drive
```

3. 前端（web）构建：

```bash
cd web
pnpm install
pnpm build
```

---

## 文档结构

- **指南**：入门与部署（左侧导航）
- **参考**：接口、后端实现与配置（/reference）

如果你希望自动从代码生成接口文档，可以运行仓库根目录下的生成脚本（见 `/scripts` 或在 CI 中执行）。

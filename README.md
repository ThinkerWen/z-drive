<p align="center">
	<img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/z-drive.png" width="220" alt="z-drive logo" />
</p>

<h1 align="center">Z-Drive</h1>

<p align="center">一个面向个人场景的现代化云平台：图库 + 云盘</p>

<p align="center">中文 | <a href="README_en.md">English</a></p>

<p align="center">
	<a href="https://zdrive.404fix.cn"><img src="https://img.shields.io/badge/docs-online-0ea5e9?style=for-the-badge" alt="docs" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/issues"><img src="https://img.shields.io/badge/issues-welcome-22c55e?style=for-the-badge" alt="issues" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/stargazers"><img src="https://img.shields.io/github/stars/ThinkerWen/z-drive?style=for-the-badge" alt="stars" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ThinkerWen/z-drive?style=for-the-badge" alt="license" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/commits/main"><img src="https://img.shields.io/github/last-commit/ThinkerWen/z-drive?style=for-the-badge" alt="last-commit" /></a>
	<a href="https://github.com/ThinkerWen/z-drive/releases"><img src="https://img.shields.io/github/v/release/ThinkerWen/z-drive?style=for-the-badge" alt="release" /></a>
	<img src="https://img.shields.io/badge/FastAPI-Backend-111827?style=for-the-badge" alt="fastapi" />
	<img src="https://img.shields.io/badge/React-Frontend-111827?style=for-the-badge" alt="react" />
</p>

---

## 项目亮点

- 图库（Gallery）
	- 上传、管理、统计、短链访问与预览
	- 支持全局/独立两种权限模式
- 云盘（Cloud）
	- 上传、文件管理、分享管理、数据统计
	- 支持目录层级、文件预览、批量操作、分享下载
- 代码片（Paste）
	- TODO

## 界面预览

### 图库页面

| 上传页 | 列表页 | 统计页 |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-upload.png" width="500" alt="gallery-upload" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-list.png" width="500" alt="gallery-list" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/gallery-stats.png" width="500" alt="gallery-stats" /> |

### 云盘页面

| 列表页 | 预览页 | 分享页 |
| --- | --- | --- |
| <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-list.png" width="500" alt="cloud-list" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-preview.png" width="500" alt="cloud-preview" /> | <img src="https://raw.githubusercontent.com/ThinkerWen/z-drive/refs/heads/main/images/cloud-share.png" width="500" alt="cloud-share" /> |

## 快速启动

### 本地运行

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

### Docker 启动

```bash
cp .env.example .env
docker compose up -d
```

## 完整文档

- 在线文档：https://zdrive.404fix.cn

## 反馈

- Issue: https://github.com/ThinkerWen/z-drive/issues
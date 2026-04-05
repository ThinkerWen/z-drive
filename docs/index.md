---
layout: home
hero:
  name: Z-Drive
  text: 个人云平台
  tagline: 图库 + 云盘一体化，面向个人备份、分享与统一管理
  image:
    src: /z-drive.webp
    alt: Z-Drive
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 部署说明
      link: /guide/deploy
features:
  - icon: 🖼️
    title: 图库管理
    details: 支持上传、预览、统计和短链访问，适合个人图床和素材管理。
  - icon: ☁️
    title: 云盘文件
    details: 支持目录层级、批量操作、公共分享页和视频预览，覆盖日常文件整理场景。
  - icon: ⚙️
    title: 统一架构
    details: 管理接口统一挂载在 /api 下，公共分享入口使用 /f/{share_code}，鉴权与调度能力集中管理。
  - icon: 🚀
    title: 易于部署
    details: SQLite + 本地磁盘即可运行，支持本地开发、Docker 部署与文档站独立发布。
---

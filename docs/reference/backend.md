# 后端与模型

本章介绍后端关键模块位置与职责，便于开发者定位实现与扩展点。

## 代码位置

- `app/main.py`：后端应用入口（启动配置、包含中间件与路由挂载）
- `app/api/`：API 路由定义（例如 health、imagebed 等路由）
- `app/services/`：业务逻辑与存储抽象（例如图床/云盘服务）
- `app/models/`：数据库模型定义（ORM）
- `app/schemas/`：Pydantic 请求/响应模型
- `app/core/config.py`：配置项与环境变量

## 存储路径约定

- 默认存储在仓库 `storage/` 下：`original/`、`preview/`、`thumbnail/`。
- 新的文档和代码已将图库根路径迁移为 `storage/gallery/`（兼容旧路径）。

## 预览生成

后端在上传后会为图片/视频生成预览并存放在 `preview/` 目录下。图片使用 Pillow 进行缩放，视频可生成缩略图或用前端播放器直接播放。

## 扩展点

- 在 `app/services/` 内添加新的存储适配器（例如 S3），并在配置中注入。
- 需要额外中间件（鉴权、限流）可在 `app/main.py` 中挂载。

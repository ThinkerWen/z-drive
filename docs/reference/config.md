# 配置项说明

本页按当前 `app/core/config.py` 和仓库根目录的 `.env.example` 整理所有常用配置。部署前建议先复制一份 `.env`，再按自己的环境修改。

## 完整示例

```bash
# z-drive runtime settings
# Copy to .env and replace sensitive values before production use.

APP_NAME=z-drive
DEBUG=false

DATABASE_URL=sqlite:///./z_drive.db
STORAGE_PATH=storage

VIEW_ORIGIN=false
ENABLE_BROWSER_CACHE=true
IMAGE_MAX_FILE_SIZE_MB=50
CLOUD_TOTAL_SPACE_MB=10240
IMAGE_AUTH_MODE=none
SIGN_SALT=replace-with-random-salt

ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-strong-password
JWT_SECRET=replace-with-long-random-secret-at-least-32-bytes
JWT_EXPIRE_MINUTES=10080
```

## 变量说明

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `APP_NAME` | `z-drive` | FastAPI 应用名称，影响接口文档标题与日志信息。 |
| `DEBUG` | `false` | 开启调试模式。生产环境建议保持关闭。 |
| `DATABASE_URL` | `sqlite:///./z_drive.db` | 数据库连接串。默认使用本地 SQLite。 |
| `STORAGE_PATH` | `storage` | 文件存储根目录。图库与云盘相关文件都会写入这里。 |
| `VIEW_ORIGIN` | `false` | 图库访问时是否始终返回原图；关闭时会优先返回压缩预览。 |
| `ENABLE_BROWSER_CACHE` | `true` | 是否给图片/文件响应添加长期缓存头。 |
| `IMAGE_MAX_FILE_SIZE_MB` | `50` | 图库上传单文件大小上限，单位 MB。 |
| `CLOUD_TOTAL_SPACE_MB` | `10240` | 云盘总容量配额，影响统计页里的总空间/可用空间计算。 |
| `IMAGE_AUTH_MODE` | `none` | 图库访问控制模式。当前支持 `none` 和 `sign`。 |
| `SIGN_SALT` | `change-me` | 全局签名盐值。`IMAGE_AUTH_MODE=sign` 时用于生成访问签名。 |
| `ADMIN_USERNAME` | `admin` | 管理端登录用户名。 |
| `ADMIN_PASSWORD` | `admin123` | 管理端登录密码。生产环境必须改掉。 |
| `JWT_SECRET` | `z-drive-change-me-secret-key-at-least-32-bytes` | 管理端 JWT 签名密钥。建议使用足够长的随机字符串。 |
| `JWT_EXPIRE_MINUTES` | `10080` | 管理端 JWT 有效期，单位分钟。默认约 7 天。 |

## 配置要点

- `DATABASE_URL` 和 `STORAGE_PATH` 是最先需要确认的两个参数。前者决定元数据存到哪里，后者决定文件写到哪里。
- 如果你想在图床链接中启用签名校验，把 `IMAGE_AUTH_MODE` 改为 `sign`，并同步配置 `SIGN_SALT`。
- 管理端账号密码不要沿用默认值，否则任何能访问站点的人都能登录后台。
- `CLOUD_TOTAL_SPACE_MB` 不是硬盘物理空间，而是业务层统计值；如果你要按实际可用空间展示，记得调成符合你环境的数字。

## 运行目录

- `storage/`：默认存储根目录。
- `storage/gallery/original/`：图库原始文件。
- `storage/gallery/preview/`：图库预览图。
- `storage/cloud/`：云盘文件。

## 修改后建议

改完 `.env` 后，建议重启应用并确认以下页面：

- 管理台是否能正常登录。
- 图库上传后能否生成预览。
- 云盘统计中的总空间是否符合预期。

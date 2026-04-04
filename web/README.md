# z-drive web

Frontend workspace for z-drive gallery management.

## Development

```bash
cd web
pnpm install
pnpm dev
```

Vite dev server proxies `/api` requests to `http://127.0.0.1:8000`.

## Build

```bash
cd web
pnpm build
```

Build output is written to `../app/static` so FastAPI can serve it in single-service mode.

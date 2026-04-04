FROM node:20-alpine AS frontend-builder

WORKDIR /src/web
COPY web/package.json web/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY web ./
RUN pnpm build

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY main.py ./main.py
COPY .env.example ./.env.example
COPY README.md README_en.md LICENSE ./
COPY --from=frontend-builder /src/app/static ./app/static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

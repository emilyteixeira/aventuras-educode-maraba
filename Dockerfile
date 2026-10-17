# Imagem única: compila o front (React) e serve tudo pela API (FastAPI). Banco = serviço `db`.
FROM node:22-alpine AS web
WORKDIR /web
RUN corepack enable
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./
RUN pnpm exec vite build

FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY apps/api/ /app/
RUN pip install -e .
COPY --from=web /web/dist /srv/web
ENV AVENTURAS_WEB_DIST=/srv/web
EXPOSE 8000
# 1 worker é obrigatório: as salas ao vivo ficam na memória do processo (PRD §5).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips", "*"]

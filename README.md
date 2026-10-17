# Aventuras do Edu — EduCode Marabá

Aventura gamificada ao vivo (Kahoot + RPG) para ensinar Computação a estudantes de 11–12 anos. **Era 1: Pensamento Computacional** (aula de 120 min com os tutores Hernandes e Emily).

**Comece por:** [`docs/PRD.md`](docs/PRD.md) (requisitos). Handover, deploy e histórico de sessões ficam fora deste repositório público.

## Estado (17/10/2026)

S0–S3 implementadas e ensaiadas: login, Edu personalizável, salas ao vivo, 5 missões / 20 perguntas, pódios, ranking individual e em grupos, selo final com recompensa. Testes: 39 no backend (SQLite e PostgreSQL) e 1 ensaio E2E em Chromium (1 tutor + 3 alunos).

## Stack

TypeScript + React 19 + Vite (front) · Python 3.12 + FastAPI + SQLAlchemy async (back) · PostgreSQL 16 · WebSocket para o jogo ao vivo.

## Rodar localmente (sem Docker)

- API + Postgres embutido: `cd apps/api && uv venv --python 3.12 && uv pip install -e ".[dev]" pgserver && .venv/bin/python scripts/dev_server.py` (API em `:8000`, códigos `TURMA-ENSAIO` / `TUTOR-ENSAIO`).
- Front: `cd apps/web && pnpm install && pnpm build` (a API serve `apps/web/dist`) ou `pnpm dev` (`:5173`, proxy para `:8000`).
- Testes: `cd apps/api && .venv/bin/pytest` · E2E: com a API no ar, `cd apps/web && node e2e/run.mjs`.

## Produção

`docker compose up -d --build` (ver `.env.example` e `infra/Caddyfile`).

## Estrutura

`apps/api` (FastAPI: `app/game/engine.py` é o motor do jogo; `app/content/era1.json` são as perguntas) · `apps/web` (React) · `infra` (Caddy) · `docs` (PRD, handover, sessões).

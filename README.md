# Aventuras do Edu — EduCode Marabá

Aventura gamificada ao vivo (Kahoot + RPG) para ensinar Computação a crianças e adolescentes, com tutores em sala.
**Anexo independente do EduCode.** Não faz parte do TCC.

| | |
|---|---|
| Status | Fase de especificação. **Ainda não há código.** |
| Primeira Era | Pensamento Computacional (aula de 120 min) |
| Stack obrigatória | TypeScript + React (front) · Python (back) · PostgreSQL 16+ (sugerido) |
| Versão anterior | Aventuras do Edu v1 (site estático, individual): `https://aventuras.educodemaraba.com.br/` |

## Comece por aqui

1. [`docs/HANDOVER.md`](docs/HANDOVER.md) — estado, decisões, pendências (5 min de leitura).
2. [`docs/PRD.md`](docs/PRD.md) — requisitos, stack, banco, Era 1, sprints.
3. [`docs/sessoes/`](docs/sessoes/) — histórico de cada sessão de trabalho.
4. [`CLAUDE.md`](CLAUDE.md) — regras para quem continuar o trabalho com Claude Code.

## Estrutura prevista (a partir do Sprint 1)

- `apps/web` — Vite + React + TypeScript
- `apps/api` — FastAPI + SQLAlchemy + Alembic
- `infra/` — Docker Compose (`web`, `api`, `db`)
- `docs/` — PRD, handover, histórico

## Portas padrão (dev)

API `8000` · Web `5173` · Postgres `5432` (interno).

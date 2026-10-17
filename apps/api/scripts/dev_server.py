"""Sobe PostgreSQL embutido (pgserver) + API em :8000 para ensaios locais.

Uso: .venv/bin/python scripts/dev_server.py   (Ctrl+C encerra tudo)
Não use em produção: lá o banco é o serviço `db` do docker-compose (infra/).
"""

import os
import sys
import tempfile

import pgserver
import uvicorn

port = int(os.environ.get("PORT", "8000"))
data = os.environ.get("PGDATA_DIR") or tempfile.mkdtemp(prefix="aventuras-pg-")
srv = pgserver.get_server(data)
uri = srv.get_uri().replace("postgresql://postgres:@", "postgresql+asyncpg://postgres@")
os.environ.setdefault("AVENTURAS_DATABASE_URL", uri)
os.environ.setdefault("AVENTURAS_CLASS_CODE", "TURMA-ENSAIO")
os.environ.setdefault("AVENTURAS_TUTOR_CODE", "TUTOR-ENSAIO")
print(f"[dev_server] Postgres: {uri}", flush=True)
sys.stdout.flush()
uvicorn.run("app.main:app", host="0.0.0.0", port=port, log_level="warning")

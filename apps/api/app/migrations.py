"""Migração explícita para PIN/QR. Não é executada automaticamente no startup."""

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

from .models import StudentCredential


async def migrate_student_access(engine: AsyncEngine, *, apply: bool = False) -> dict:
    if engine.dialect.name != "postgresql":
        raise ValueError("Esta migração é exclusiva para PostgreSQL; SQLite usa schema novo.")
    async with engine.begin() as conn:
        columns = await conn.run_sync(lambda c: inspect(c).get_columns("users"))
        nullable = {c["name"]: c["nullable"] for c in columns}
        if not {"id", "email", "password_hash", "role"} <= nullable.keys():
            raise ValueError("Schema users inesperado. Nenhuma alteração aplicada.")
        needed = [name for name in ("email", "password_hash") if not nullable[name]]
        exists = await conn.run_sync(
            lambda c: inspect(c).has_table(StudentCredential.__tablename__)
        )
        if apply:
            await conn.execute(text("SET LOCAL lock_timeout = '5s'"))
            for name in needed:
                await conn.execute(text(f"ALTER TABLE users ALTER COLUMN {name} DROP NOT NULL"))
            await conn.run_sync(lambda c: StudentCredential.__table__.create(c, checkfirst=True))
        return {"applied": apply, "nullable_columns_needed": needed, "credential_table_exists": exists}

"""Migração em PostgreSQL descartável, nunca no TEST_DATABASE_URL ou produção."""

import pgserver
from sqlalchemy import inspect, select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.db import Base
from app.migrations import migrate_student_access
from app.models import Character, User, XpLedger


async def test_postgres_migration_preserves_data_and_is_idempotent(tmp_path):
    server = pgserver.get_server(tmp_path / "postgres")
    uri = server.get_uri().replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(uri)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("DROP TABLE student_credentials"))
            await conn.execute(text("ALTER TABLE users ALTER COLUMN email SET NOT NULL"))
            await conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL"))
            await conn.execute(User.__table__.insert().values(email="old@example.test", password_hash="legacy-hash", nickname="Antigo", role="student"))
            await conn.execute(Character.__table__.insert().values(user_id=1, appearance={"cls": "robo"}, tools=["livro", "lupa"], unlocked=["capa_cartografo"]))
            await conn.execute(XpLedger.__table__.insert().values(user_id=1, source="old", xp=650))
        preflight = await migrate_student_access(engine)
        assert preflight["applied"] is False
        assert preflight["nullable_columns_needed"] == ["email", "password_hash"]
        assert not preflight["credential_table_exists"]
        async with engine.connect() as conn:
            assert not await conn.run_sync(lambda c: inspect(c).has_table("student_credentials"))
        await migrate_student_access(engine, apply=True)
        again = await migrate_student_access(engine, apply=True)
        assert again["nullable_columns_needed"] == []
        assert again["credential_table_exists"]
        async with engine.begin() as conn:
            user = (await conn.execute(select(User.__table__))).mappings().one()
            assert user["id"] == 1 and user["email"] == "old@example.test"
            assert user["password_hash"] == "legacy-hash"
            assert (await conn.execute(select(Character.unlocked))).scalar_one() == ["capa_cartografo"]
            assert (await conn.execute(select(XpLedger.xp))).scalar_one() == 650
            await conn.execute(User.__table__.insert().values(nickname="Novo", role="student"))
    finally:
        await engine.dispose()
        server.cleanup()

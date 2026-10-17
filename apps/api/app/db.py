"""Conexão assíncrona com o banco (PostgreSQL em produção; SQLite só em testes rápidos)."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_maker: async_sessionmaker[AsyncSession] | None = None


def init_engine(url: str | None = None) -> None:
    global _engine, _maker
    url = url or get_settings().database_url
    kwargs: dict = {}
    if url.startswith("postgresql"):
        kwargs.update(pool_size=10, max_overflow=20, pool_pre_ping=True)
    _engine = create_async_engine(url, **kwargs)
    _maker = async_sessionmaker(_engine, expire_on_commit=False)


def get_engine():
    assert _engine is not None, "init_engine() não foi chamado"
    return _engine


def session_maker() -> async_sessionmaker[AsyncSession]:
    assert _maker is not None, "init_engine() não foi chamado"
    return _maker


async def create_all() -> None:
    from . import models  # noqa: F401  (registra as tabelas)

    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose() -> None:
    if _engine is not None:
        await _engine.dispose()


async def get_db() -> AsyncIterator[AsyncSession]:
    async with session_maker()() as session:
        yield session

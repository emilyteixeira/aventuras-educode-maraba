import os

import pytest
import pytest_asyncio

os.environ.setdefault("AVENTURAS_CLASS_CODE", "TURMA-TESTE")
os.environ.setdefault("AVENTURAS_TUTOR_CODE", "TUTOR-TESTE")


@pytest_asyncio.fixture
async def app_db(tmp_path):
    """App com SQLite em arquivo temporário (rápido). Postgres real: ver test_postgres.py."""
    from app import db
    from app.config import get_settings
    from app.game.content import load_era
    from app.game.engine import hub
    from app.security import login_limiter

    get_settings.cache_clear()
    load_era.cache_clear()
    hub.rooms.clear()
    login_limiter.reset()
    url = os.environ.get("TEST_DATABASE_URL") or f"sqlite+aiosqlite:///{tmp_path}/t.db"
    db.init_engine(url)
    from app import models  # noqa: F401

    async with db.get_engine().begin() as conn:
        await conn.run_sync(db.Base.metadata.drop_all)
    await db.create_all()
    yield db
    await db.dispose()


@pytest_asyncio.fixture
async def client(app_db):
    import httpx

    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class FakeWS:
    """WebSocket falso que guarda o último estado recebido."""

    def __init__(self) -> None:
        self.msgs: list[dict] = []

    async def send_json(self, payload: dict) -> None:
        self.msgs.append(payload)

    @property
    def state(self) -> dict:
        return next(m for m in reversed(self.msgs) if m["t"] == "state")

    @property
    def errors(self) -> list[str]:
        return [m["msg"] for m in self.msgs if m["t"] == "error"]


@pytest.fixture
def fakews():
    return FakeWS

import httpx
from fastapi import WebSocketDisconnect
from sqlalchemy import delete, select
from test_api import CHAR, join, register, room

from app import db
from app.main import ws_session
from app.models import AuthSession, GameSession, User
from app.routers import auth


class SocketProbe:
    def __init__(self, token=None):
        self.headers = {"origin": "http://test", "host": "test"}
        self.cookies = {"aventuras_sid": token} if token else {}
        self.closed = None
        self.messages = []

    async def accept(self):
        pass

    async def close(self, code):
        self.closed = code

    async def send_json(self, payload):
        self.messages.append(payload)

    async def receive_text(self):
        raise WebSocketDisconnect()


async def test_ws_requires_auth_enrollment_and_character(client):
    code = await room(client)
    anon = SocketProbe()
    await ws_session(anon, code)
    assert anon.closed == 4401 and not anon.messages
    await join(client, code)
    token = client.cookies.get("aventuras_sid")
    incomplete = SocketProbe(token)
    await ws_session(incomplete, code)
    assert incomplete.closed == 4409 and not incomplete.messages
    await client.put("/api/me/character", json=CHAR)
    async with db.session_maker()() as session:
        tutor = (await session.execute(select(User).where(User.role == "tutor"))).scalar_one()
        session.add(GameSession(code="XYZ234", tutor_id=tutor.id, state={}))
        await session.commit()
    forbidden = SocketProbe(token)
    await ws_session(forbidden, "XYZ234")
    assert forbidden.closed == 4403 and not forbidden.messages
    enrolled = SocketProbe(token)
    await ws_session(enrolled, code)
    assert enrolled.closed is None
    assert enrolled.messages[0]["role"] == "student"
    assert "secret" not in enrolled.messages[0]


async def test_shared_school_ip_allows_class_but_limits_join_and_recovery(client):
    code = await room(client)
    for i in range(90):
        result = await join(client, code, nickname="Aluno")
        assert result.status_code == 200, i
    assert (await join(client, code)).status_code == 429


async def test_recovery_rate_limit(client):
    code = await room(client)
    for _ in range(30):
        assert (await join(client, code, recovery_code="A" * 16)).status_code == 401
    assert (await join(client, code, recovery_code="A" * 16)).status_code == 429


async def test_cookie_revoked_between_auth_and_lock_cannot_reopen_session(client, monkeypatch):
    code = await room(client)
    await join(client, code)
    original = auth.user_from_token

    async def revoke_after_check(database, token):
        user = await original(database, token)
        if user:
            await database.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
            await database.commit()
        return user

    monkeypatch.setattr(auth, "user_from_token", revoke_after_check)
    assert (await join(client, code)).status_code == 401
    assert (await client.get("/api/me")).status_code == 401


async def test_three_tutors_receive_private_controls(client):
    code = await room(client)
    for name in ("Emily", "Hernandes", "Felipe"):
        async with httpx.AsyncClient(transport=client._transport, base_url="http://test") as teacher:
            await register(teacher, email=f"{name.lower()}@example.test", nick=name)
            probe = SocketProbe(teacher.cookies.get("aventuras_sid"))
            await ws_session(probe, code)
            assert probe.closed is None
            assert probe.messages[0]["role"] == "tutor"
            assert "secret" in probe.messages[0]["tutor"]

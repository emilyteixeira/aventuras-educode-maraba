import re

import httpx
import pytest
from sqlalchemy import func, select

from app import db
from app.models import (
    AuditLog,
    Character,
    GameSession,
    SessionPlayer,
    StudentCredential,
    User,
    XpLedger,
)
from app.security import hash_password, token_hash

CHAR = {
    "appearance": {"cls": "heroi", "color": "pele5", "hair_style": "cacheado", "hair_color": "preto", "accessories": ["capa"]},
    "tools": ["livro", "lupa"],
    "scenario": "floresta",
    "world": "luzes",
}


async def register(client, email="t@example.test", nick="Emily", code="TUTOR-TESTE", pw="senha1234"):
    return await client.post("/api/auth/register", json={"email": email, "password": pw, "nickname": nick, "code": code})


async def room(client):
    assert (await register(client)).status_code == 201
    result = await client.post("/api/sessions")
    code = result.json()["code"]
    await client.post("/api/auth/logout")
    return code


async def join(client, code, nickname="Ana", recovery_code=None):
    body = {"code": code, "nickname": nickname}
    if recovery_code is not None:
        body["recovery_code"] = recovery_code
    return await client.post("/api/auth/student", json=body)


async def test_register_only_tutor_invite(client):
    assert (await register(client, code="TURMA-TESTE")).status_code == 403
    assert (await register(client, code="ERRADO")).status_code == 403
    assert (await register(client, code="TUTOR-TROQUE-ME")).status_code == 403
    assert (await register(client)).json()["role"] == "tutor"


async def test_tutor_login_and_validation(client):
    assert (await register(client, pw="curta")).status_code == 422
    assert (await register(client, email="sem-arroba")).status_code == 422
    assert (await register(client, nick="x")).status_code == 422
    assert (await register(client)).status_code == 201
    assert (await register(client)).status_code == 409
    await client.post("/api/auth/logout")
    assert (await client.get("/api/me")).status_code == 401
    assert (await client.post("/api/auth/login", json={"email": "T@EXAMPLE.TEST", "password": "senha1234"})).status_code == 200
    for email in ("t@example.test", "nao@existe.test"):
        result = await client.post("/api/auth/login", json={"email": email, "password": "errada123"})
        assert result.status_code == 401
        assert result.json()["detail"] == "E-mail ou senha incorretos."


async def test_login_rate_limit_cannot_spoof_forwarded_header(client):
    await register(client)
    codes = []
    for i in range(12):
        result = await client.post("/api/auth/login", json={"email": "t@example.test", "password": "errada123"}, headers={"x-forwarded-for": f"10.0.0.{i}"})
        codes.append(result.status_code)
    assert codes[:10] == [401] * 10
    assert codes[10:] == [429] * 2


async def test_new_student_private_code_and_same_device(client):
    code = await room(client)
    result = await join(client, code.lower())
    assert result.status_code == 200
    data = result.json()
    assert re.fullmatch(r"[A-Z2-7]{16}", data["personal_code"])
    assert result.headers["cache-control"] == "no-store"
    cookie = result.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    profile = (await client.get("/api/me")).json()
    assert profile["nickname"] == "Ana" and profile["role"] == "student"
    assert profile["room_code"] == code and not profile["onboarding_done"]
    assert "email" not in profile and "personal_code" not in profile
    async with db.session_maker()() as session:
        user = await session.get(User, data["id"])
        credential = await session.get(StudentCredential, data["id"])
        assert user.email is None and user.password_hash is None
        assert credential.code_hash == token_hash(data["personal_code"])
        assert data["personal_code"] not in credential.code_hash
    again = (await join(client, code, "OutraPessoa")).json()
    assert again["id"] == data["id"] and again["nickname"] == "Ana"
    assert again["personal_code"] is None
    async with db.session_maker()() as session:
        assert (await session.execute(select(func.count()).select_from(SessionPlayer))).scalar_one() == 1


async def test_recovery_other_device_keeps_character_xp_inventory(client):
    code = await room(client)
    original = (await join(client, code)).json()
    assert (await client.put("/api/me/character", json=CHAR)).status_code == 200
    async with db.session_maker()() as session:
        ch = await session.get(Character, original["id"])
        ch.unlocked = ["capa_cartografo"]
        session.add(XpLedger(user_id=original["id"], source="test", xp=650))
        await session.commit()
    async with httpx.AsyncClient(transport=client._transport, base_url="http://test") as other:
        recovered = await join(other, code, nickname="NaoSobrescrever", recovery_code=original["personal_code"].lower())
        assert recovered.status_code == 200 and recovered.json()["id"] == original["id"]
        profile = (await other.get("/api/me")).json()
        assert profile["nickname"] == "Ana"
        assert profile["character"]["appearance"] == CHAR["appearance"]
        assert profile["character"]["unlocked"] == ["capa_cartografo"]
        assert profile["xp"] == 650 and profile["onboarding_done"]


async def test_nickname_never_recovers_identity(client):
    code = await room(client)
    first = (await join(client, code)).json()
    await client.post("/api/auth/logout")
    second = (await join(client, code)).json()
    assert second["id"] != first["id"]
    assert second["personal_code"] != first["personal_code"]


async def test_pin_recovery_validation_and_closed_room(client):
    code = await room(client)
    assert (await join(client, "ERRADO")).status_code == 422
    assert (await join(client, "ZZZZZZ")).status_code == 404
    assert (await join(client, code, nickname="x")).status_code == 422
    assert (await join(client, code, recovery_code="A" * 16)).status_code == 401
    assert (await join(client, code, recovery_code="")).status_code == 422
    async with db.session_maker()() as session:
        gs = (await session.execute(select(GameSession))).scalar_one()
        gs.status = "finished"
        await session.commit()
    assert (await join(client, code)).status_code == 404


async def test_student_never_gets_tutor_access(client):
    code = await room(client)
    pupil = (await join(client, code)).json()
    assert (await client.post("/api/sessions")).status_code == 403
    assert (await client.get("/api/sessions")).status_code == 403
    assert (await client.get("/api/sessions/students/search?q=Ana")).status_code == 403
    assert (await client.post(f"/api/sessions/students/{pupil['id']}/recovery-code")).status_code == 403
    assert (await register(client, email="fake@example.test", code=code)).status_code == 403
    assert (await client.get(f"/api/sessions/{code}")).status_code == 200
    async with db.session_maker()() as session:
        tutor = (await session.execute(select(User).where(User.role == "tutor"))).scalar_one()
        other = GameSession(code="XYZ234", tutor_id=tutor.id, state={})
        session.add(other)
        await session.commit()
    assert (await client.get("/api/sessions/XYZ234")).status_code == 403


async def test_legacy_student_assisted_recovery_and_rotation(client):
    await register(client)
    code = (await client.post("/api/sessions")).json()["code"]
    async with db.session_maker()() as session:
        legacy = User(email="old@example.test", password_hash=await hash_password("old-password"), nickname="Antigo", role="student")
        session.add(legacy)
        await session.flush()
        uid = legacy.id
        session.add(Character(user_id=uid, **CHAR, unlocked=["capa_cartografo"]))
        session.add(XpLedger(user_id=uid, source="legacy", xp=600))
        await session.commit()
    found = await client.get("/api/sessions/students/search?q=Antigo")
    assert found.status_code == 200 and found.json()[0]["id"] == uid
    assert "email" not in found.text
    assert (await client.post(
        f"/api/sessions/students/{uid}/recovery-code",
        headers={"origin": "https://outra-origem.example.test"},
    )).status_code == 403
    issued = await client.post(f"/api/sessions/students/{uid}/recovery-code")
    first = issued.json()["personal_code"]
    async with httpx.AsyncClient(transport=client._transport, base_url="http://test") as pupil:
        assert (await pupil.post("/api/auth/login", json={"email": "old@example.test", "password": "old-password"})).status_code == 401
        assert (await join(pupil, code, recovery_code=first)).json()["id"] == uid
        assert (await pupil.get("/api/me")).json()["xp"] == 600
        second = (await client.post(f"/api/sessions/students/{uid}/recovery-code")).json()["personal_code"]
        assert second != first
        assert (await pupil.get("/api/me")).status_code == 401
        assert (await join(pupil, code, recovery_code=first)).status_code == 401
        assert (await join(pupil, code, recovery_code=second)).json()["id"] == uid
        assert (await pupil.get("/api/me")).json()["character"]["appearance"] == CHAR["appearance"]
    async with db.session_maker()() as session:
        logs = (await session.execute(select(AuditLog).where(AuditLog.action == "student.recovery.rotate"))).scalars().all()
        assert len(logs) == 2
        assert all(log.target == str(uid) for log in logs)
    assert (await client.post("/api/sessions/students/999999/recovery-code")).status_code == 404
    assert (await client.post("/api/auth/student", json={"code": code, "nickname": "Tutor"})).status_code == 403


@pytest.mark.parametrize("nickname", ["Emily", "Hernandes", "Felipe"])
async def test_individual_tutors_can_share_room(client, nickname):
    code = await room(client)
    result = await register(client, email=f"{nickname.lower()}@example.test", nick=nickname)
    assert result.status_code == 201
    assert result.json()["role"] == "tutor"
    assert (await client.get(f"/api/sessions/{code}")).status_code == 200
    assert code in {g["code"] for g in (await client.get("/api/sessions")).json()}


async def test_character_validation_and_unauthenticated_endpoints(client):
    assert (await client.get("/api/me")).status_code == 401
    assert (await client.get("/api/catalog")).status_code == 200
    assert (await client.get("/api/health")).json() == {"ok": True}
    code = await room(client)
    await join(client, code)
    assert (await client.put("/api/me/character", json={**CHAR, "tools": ["livro"]})).status_code == 422

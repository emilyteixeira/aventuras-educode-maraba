"""Cadastro, login e logout (e-mail + senha, cookie httpOnly)."""

import hmac
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..models import AuthSession, Character, User
from ..schemas import LoginIn, RegisterIn
from ..security import (
    hash_password,
    login_limiter,
    new_token,
    token_hash,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Hash fixo para igualar o tempo de resposta quando o e-mail não existe.
_DUMMY_HASH = (
    "$argon2id$v=19$m=65536,t=3,p=1$c29tZXNhbHRzb21lc2FsdA$"
    "Zm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmFyZm9vYmE"
)


def _set_cookie(response: Response, token: str) -> None:
    s = get_settings()
    response.set_cookie(
        s.cookie_name,
        token,
        max_age=s.session_max_days * 86400,
        httponly=True,
        samesite="lax",
        secure=s.cookie_secure,
        path="/",
    )


async def _open_session(db: AsyncSession, response: Response, user_id: int) -> None:
    s = get_settings()
    token = new_token()
    now = datetime.now(UTC)
    db.add(
        AuthSession(
            token_hash=token_hash(token),
            user_id=user_id,
            created_at=now,
            last_seen=now,
            expires_at=now + timedelta(days=s.session_max_days),
        )
    )
    await db.commit()
    _set_cookie(response, token)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "?"


@router.post("/register", status_code=201)
async def register(
    body: RegisterIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    s = get_settings()
    key = f"reg:{_client_ip(request)}"
    if not login_limiter.allow(key, 30):
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    code = body.code.strip()
    if hmac.compare_digest(code.upper(), s.tutor_code.upper()):
        role = "tutor"
    elif hmac.compare_digest(code.upper(), s.class_code.upper()):
        role = "student"
    else:
        raise HTTPException(403, "Código da turma inválido. Peça aos tutores.")
    user = User(
        email=body.email,
        password_hash=await hash_password(body.password),
        nickname=body.nickname,
        role=role,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Esse e-mail já tem cadastro. Use Entrar.") from None
    db.add(Character(user_id=user.id, appearance={}, tools=[], unlocked=[]))
    await db.commit()
    await _open_session(db, response, user.id)
    return {"id": user.id, "nickname": user.nickname, "role": user.role}


@router.post("/login")
async def login(
    body: LoginIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    s = get_settings()
    key = f"login:{_client_ip(request)}:{body.email}"
    if not login_limiter.allow(key, s.login_attempts_per_minute):
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    ok = await verify_password(user.password_hash if user else _DUMMY_HASH, body.password)
    if not user or not ok:
        raise HTTPException(401, "E-mail ou senha incorretos.")
    await _open_session(db, response, user.id)
    return {"id": user.id, "nickname": user.nickname, "role": user.role}


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    s = get_settings()
    token = request.cookies.get(s.cookie_name)
    if token:
        sess = await db.get(AuthSession, token_hash(token))
        if sess:
            await db.delete(sess)
            await db.commit()
    response.delete_cookie(s.cookie_name, path="/")

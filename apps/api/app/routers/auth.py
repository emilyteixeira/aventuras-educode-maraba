"""Tutores por convite/e-mail; alunos por PIN e código pessoal privado."""

import hmac
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import get_settings
from ..db import get_db
from ..deps import user_from_token
from ..models import AuthSession, Character, GameSession, SessionPlayer, StudentCredential, User
from ..schemas import LoginIn, RegisterIn, StudentJoinIn
from ..security import (
    hash_password,
    login_limiter,
    new_student_code,
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
    response.headers["Cache-Control"] = "no-store"
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
    # O servidor ASGI trata proxies confiáveis. Não confiar no header fornecido pelo cliente.
    return request.client.host if request.client else "?"


@router.post("/register", status_code=201)
async def register(
    body: RegisterIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    s = get_settings()
    key = f"reg:{_client_ip(request)}"
    if not login_limiter.allow(key, 90):  # escola inteira sai por um IP
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    code = body.code.strip()
    if (
        not s.tutor_code
        or s.tutor_code.upper() == "TUTOR-TROQUE-ME"
        or not hmac.compare_digest(code.upper().encode(), s.tutor_code.upper().encode())
    ):
        raise HTTPException(403, "Convite de tutor inválido. Alunos entram pelo PIN da sala.")
    user = User(
        email=body.email,
        password_hash=await hash_password(body.password),
        nickname=body.nickname,
        role="tutor",
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

@router.post("/student")
async def student_join(
    body: StudentJoinIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    response.headers["Cache-Control"] = "no-store"
    ip = _client_ip(request)
    if not login_limiter.allow(f"join:{ip}", 90):
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    gs = (
        await db.execute(
            select(GameSession).where(
                GameSession.code == body.code, GameSession.status == "open"
            ).with_for_update()
        )
    ).scalar_one_or_none()
    if gs is None:
        raise HTTPException(404, "Sala não encontrada ou encerrada. Confira o PIN com os tutores.")

    cookie = request.cookies.get(get_settings().cookie_name)
    current = await user_from_token(db, cookie)
    if current and current.role == "tutor":
        raise HTTPException(403, "Use o painel de tutores para acompanhar a sala.")
    personal_code = None
    if body.recovery_code:
        if not login_limiter.allow(f"recover:{ip}", 30):
            raise HTTPException(429, "Muitas tentativas. Peça ajuda aos tutores.")
        user = (
            await db.execute(
                select(User).join(StudentCredential).where(
                    StudentCredential.code_hash == token_hash(body.recovery_code),
                    User.role == "student",
                ).with_for_update(of=User)
            )
        ).scalar_one_or_none()
        if user is None:
            raise HTTPException(401, "Código pessoal inválido. Peça ajuda aos tutores.")
        # Releitura após o lock: uma rotação concorrente pode ter invalidado o código.
        credential = await db.get(StudentCredential, user.id, populate_existing=True)
        if credential is None or not hmac.compare_digest(
            credential.code_hash, token_hash(body.recovery_code)
        ):
            raise HTTPException(401, "Código pessoal inválido. Peça ajuda aos tutores.")
    elif current:
        user = (
            await db.execute(select(User).where(User.id == current.id).with_for_update())
        ).scalar_one()
        active = await db.get(AuthSession, token_hash(cookie), populate_existing=True)
        if active is None:
            raise HTTPException(401, "Sessão encerrada. Use seu código pessoal para entrar.")
    else:
        if not body.nickname:
            raise HTTPException(422, "Informe seu apelido ou use seu código pessoal.")
        user = User(nickname=body.nickname, role="student")
        db.add(user)
        await db.flush()
        db.add(Character(user_id=user.id, appearance={}, tools=[], unlocked=[]))
        personal_code = new_student_code()
        db.add(StudentCredential(user_id=user.id, code_hash=token_hash(personal_code)))
    member = (
        await db.execute(select(SessionPlayer).where(
            SessionPlayer.session_id == gs.id, SessionPlayer.user_id == user.id
        ))
    ).scalar_one_or_none()
    if member is None:
        db.add(SessionPlayer(session_id=gs.id, user_id=user.id))
    await _open_session(db, response, user.id)
    return {
        "id": user.id, "nickname": user.nickname, "role": "student",
        "room_code": gs.code, "personal_code": personal_code,
    }


@router.post("/login")
async def login(
    body: LoginIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)
):
    s = get_settings()
    key = f"login:{_client_ip(request)}:{body.email}"
    if not login_limiter.allow(key, s.login_attempts_per_minute):
        raise HTTPException(429, "Muitas tentativas. Aguarde um minuto.")
    user = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    eligible = user is not None and user.role == "tutor" and bool(user.password_hash)
    ok = await verify_password(user.password_hash if eligible else _DUMMY_HASH, body.password)
    if not eligible or not ok:
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

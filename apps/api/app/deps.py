"""Dependências: usuário autenticado via cookie de sessão."""

from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .db import get_db
from .models import AuthSession, User
from .security import token_hash


def aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


async def user_from_token(db: AsyncSession, token: str | None) -> User | None:
    if not token:
        return None
    s = get_settings()
    sess = await db.get(AuthSession, token_hash(token))
    if sess is None:
        return None
    now = datetime.now(UTC)
    if aware(sess.expires_at) < now or aware(sess.last_seen) + timedelta(hours=s.session_idle_hours) < now:
        await db.delete(sess)
        await db.commit()
        return None
    if now - aware(sess.last_seen) > timedelta(minutes=5):
        sess.last_seen = now
        await db.commit()
    return await db.get(User, sess.user_id)


async def current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    user = await user_from_token(db, request.cookies.get(get_settings().cookie_name))
    if user is None:
        raise HTTPException(401, "Faça login para continuar.")
    return user


async def tutor_user(user: User = Depends(current_user)) -> User:
    if user.role != "tutor":
        raise HTTPException(403, "Somente tutores.")
    return user

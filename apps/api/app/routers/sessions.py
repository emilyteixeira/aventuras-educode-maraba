"""Criação e consulta de sessões de jogo (tutores)."""

import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import current_user, tutor_user
from ..models import AuditLog, GameSession, User

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # sem I, L, O, 0, 1


def new_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(6))


@router.post("", status_code=201)
async def create_session(tutor: User = Depends(tutor_user), db: AsyncSession = Depends(get_db)):
    for _ in range(10):
        code = new_code()
        exists = (await db.execute(select(GameSession.id).where(GameSession.code == code))).first()
        if not exists:
            break
    else:  # pragma: no cover
        raise HTTPException(500, "Não foi possível gerar o código.")
    gs = GameSession(code=code, tutor_id=tutor.id, era_id="era1", status="open", state={})
    db.add(gs)
    await db.flush()
    db.add(AuditLog(actor_id=tutor.id, action="session.create", target=code))
    await db.commit()
    return {"code": code, "era": "era1"}


@router.get("")
async def list_sessions(tutor: User = Depends(tutor_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(GameSession).where(GameSession.status == "open").order_by(GameSession.id.desc()).limit(10)
        )
    ).scalars()
    return [{"code": g.code, "era": g.era_id, "status": g.status} for g in rows]


@router.get("/{code}")
async def get_session(code: str, _: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    gs = (
        await db.execute(select(GameSession).where(GameSession.code == code.upper()))
    ).scalar_one_or_none()
    if gs is None or gs.status != "open":
        raise HTTPException(404, "Sala não encontrada ou encerrada.")
    return {"code": gs.code, "era": gs.era_id, "status": gs.status}

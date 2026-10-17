"""Perfil do aluno, personagem (Edu) e catálogo de personalização."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import catalog
from ..db import get_db
from ..deps import current_user
from ..game.engine import level_for
from ..models import Character, User, XpLedger
from ..schemas import CharacterIn

router = APIRouter(prefix="/api", tags=["me"])


def onboarding_done(ch: Character | None) -> bool:
    return bool(ch and ch.appearance.get("cls") and len(ch.tools or []) == catalog.TOOLS_TO_PICK)


@router.get("/catalog")
async def get_catalog():
    return catalog.catalog()


@router.get("/me")
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    ch = await db.get(Character, user.id)
    xp = (
        await db.execute(select(func.coalesce(func.sum(XpLedger.xp), 0)).where(XpLedger.user_id == user.id))
    ).scalar_one()
    return {
        "id": user.id,
        "nickname": user.nickname,
        "role": user.role,
        "xp": xp,
        "level": level_for(xp),
        "onboarding_done": onboarding_done(ch),
        "character": {
            "appearance": ch.appearance,
            "tools": ch.tools,
            "scenario": ch.scenario,
            "world": ch.world,
            "unlocked": ch.unlocked,
        }
        if ch
        else None,
    }


@router.put("/me/character")
async def save_character(
    body: CharacterIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)
):
    ch = await db.get(Character, user.id)
    if ch is None:
        ch = Character(user_id=user.id, unlocked=[])
        db.add(ch)
    try:
        catalog.validate_character(
            body.appearance, body.tools, body.scenario, body.world, ch.unlocked or []
        )
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    ch.appearance = body.appearance
    ch.tools = body.tools
    ch.scenario = body.scenario
    ch.world = body.world
    await db.commit()
    return {"ok": True}

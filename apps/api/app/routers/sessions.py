"""Criação e consulta de sessões de jogo (tutores)."""

import secrets
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, WebSocketDisconnect
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..deps import current_user, tutor_user
from ..models import AuditLog, AuthSession, GameSession, SessionPlayer, StudentCredential, User
from ..security import new_student_code, token_hash

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

@router.get("/students/search")
async def find_students(
    response: Response, q: str = Query(min_length=2, max_length=16),
    _: User = Depends(tutor_user), db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    rows = (await db.execute(
        select(User).where(
            User.role == "student", func.lower(User.nickname) == q.strip().lower()
        ).order_by(User.id).limit(20)
    )).scalars()
    return [{"id": u.id, "nickname": u.nickname, "created_at": u.created_at} for u in rows]


@router.post("/students/{user_id}/recovery-code")
async def reset_student_code(
    user_id: int, request: Request, response: Response, tutor: User = Depends(tutor_user),
    db: AsyncSession = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"
    origin = request.headers.get("origin")
    if origin and urlparse(origin).netloc != request.headers.get("host"):
        raise HTTPException(403, "Origem da solicitação inválida.")
    user = (await db.execute(
        select(User).where(User.id == user_id, User.role == "student").with_for_update()
    )).scalar_one_or_none()
    if user is None:
        raise HTTPException(404, "Aluno não encontrado.")
    credential = await db.get(StudentCredential, user.id)
    code = new_student_code()
    if credential:
        from ..models import now
        credential.code_hash = token_hash(code)
        credential.issued_at = now()
    else:
        db.add(StudentCredential(user_id=user.id, code_hash=token_hash(code)))
    await db.execute(delete(AuthSession).where(AuthSession.user_id == user.id))
    db.add(AuditLog(actor_id=tutor.id, action="student.recovery.rotate", target=str(user.id)))
    await db.commit()
    # Revogação também alcança WebSockets já conectados, não só novos requests.
    from ..game.engine import hub
    for room in list(hub.rooms.values()):
        async with room.lock:
            player = room.players.get(user.id)
            if player:
                for ws in list(player.conns):
                    try:
                        await ws.close(code=4401)
                    except (RuntimeError, WebSocketDisconnect):
                        pass
                player.conns.clear()
    return {"id": user.id, "nickname": user.nickname, "personal_code": code}


@router.get("")
async def list_sessions(tutor: User = Depends(tutor_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(GameSession).where(GameSession.status == "open").order_by(GameSession.id.desc()).limit(10)
        )
    ).scalars()
    return [{"code": g.code, "era": g.era_id, "status": g.status} for g in rows]


@router.get("/{code}")
async def get_session(code: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    gs = (
        await db.execute(select(GameSession).where(GameSession.code == code.upper()))
    ).scalar_one_or_none()
    if gs is None or gs.status != "open":
        raise HTTPException(404, "Sala não encontrada ou encerrada.")
    if user.role != "tutor":
        member = (await db.execute(select(SessionPlayer.id).where(
            SessionPlayer.session_id == gs.id, SessionPlayer.user_id == user.id
        ))).first()
        if member is None:
            raise HTTPException(403, "Entre nesta sala pelo PIN primeiro.")
    return {"code": gs.code, "era": gs.era_id, "status": gs.status}

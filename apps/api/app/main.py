"""Aplicação FastAPI: API REST, WebSocket do jogo e front compilado (SPA)."""

import json
from contextlib import asynccontextmanager
from urllib.parse import urlparse

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import db
from .config import get_settings
from .deps import user_from_token
from .game.engine import hub
from .models import Character
from .routers import auth, me, sessions

# Códigos de fechamento do WebSocket entendidos pelo front
WS_UNAUTH, WS_NOT_FOUND, WS_FORBIDDEN, WS_ONBOARDING = 4401, 4404, 4403, 4409


@asynccontextmanager
async def lifespan(app: FastAPI):
    if db._engine is None:
        db.init_engine()
    await db.create_all()
    yield
    await db.dispose()


app = FastAPI(title="Aventuras do Edu", version="0.2.0", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(me.router)
app.include_router(sessions.router)


@app.get("/api/health")
async def health():
    return {"ok": True}


def _origin_ok(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    if not origin:  # clientes não-navegador (testes)
        return True
    host = ws.headers.get("x-forwarded-host") or ws.headers.get("host", "")
    return urlparse(origin).netloc == host


@app.websocket("/ws/sessions/{code}")
async def ws_session(ws: WebSocket, code: str):
    s = get_settings()
    await ws.accept()
    if not _origin_ok(ws):
        return await ws.close(WS_FORBIDDEN)
    async with db.session_maker()() as session:
        user = await user_from_token(session, ws.cookies.get(s.cookie_name))
        ch = await session.get(Character, user.id) if user else None
    if user is None:
        return await ws.close(WS_UNAUTH)
    appearance, tools = (ch.appearance, ch.tools) if ch else ({}, [])
    if user.role == "student" and not (appearance.get("cls") and len(tools) == 2):
        return await ws.close(WS_ONBOARDING)
    room = await hub.get_room(code.upper())
    if room is None:
        return await ws.close(WS_NOT_FOUND)
    xp = await hub.xp_total(user.id)
    await room.join(ws, user.id, user.nickname, user.role, appearance, tools, xp)
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > s.ws_max_message_bytes:
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if not isinstance(msg, dict):
                continue
            if msg.get("t") == "ping":
                await ws.send_json({"t": "pong"})
                continue
            await room.handle(user.id, user.role, msg)
    except (WebSocketDisconnect, RuntimeError, KeyError):
        pass
    finally:
        await room.leave(ws, user.id, user.role)


# --- front compilado (apps/web/dist) --------------------------------------
_dist = get_settings().web_dist
if _dist.exists():
    if (_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith(("api/", "ws/")):
            return JSONResponse({"detail": "Não encontrado."}, status_code=404)
        f = (_dist / path).resolve()
        if path and f.is_file() and _dist.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(_dist / "index.html")

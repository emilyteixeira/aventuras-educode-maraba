"""Motor de jogo ao vivo (uma Room por sessão, estado em memória + tudo persistido).

Fases: lobby → intro → question → reveal → (… ) → podium → intro … → unlock → finished.
Gabarito, pontuação e frase-chave existem só aqui (servidor); o cliente recebe visões
personalizadas por jogador. Ver docs/PRD.md §5–§6.
"""

from __future__ import annotations

import asyncio
import hashlib
import random
import time
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import func, select

from .. import catalog
from ..db import session_maker
from ..models import Answer, Character, GameSession, UnlockAttempt, XpLedger
from .content import load_era, norm

BASE_POINTS = 800
SPEED_BONUS = 200
GRACE_S = 1.0
LANTERN_S = 10
SHOVEL_BONUS = 150
COMBO_BONUS = 300
BOSS_MULT = 1.5
MISSION_XP = 50
UNLOCK_XP = 200
LEVELS = (250, 600, 1050, 1600, 2200)
REVEAL_AUTO_S = 12
UNLOCK_COOLDOWN_S = 3.0
GROUP_NAMES = [
    "Dragões", "Fênix", "Lobos", "Corujas", "Grifos", "Unicórnios",
    "Krakens", "Gárgulas", "Fadas", "Golens", "Sereias", "Centauros",
]


def level_for(xp: int) -> int:
    return 1 + sum(1 for t in LEVELS if xp >= t)


def score_answer(
    correct: bool, elapsed_s: float, limit_s: float, mult: float = 1.0, boss: bool = False,
    shovel: bool = False,
) -> int:
    if not correct:
        return 0
    frac = max(0.0, 1.0 - elapsed_s / limit_s)
    pts = round((BASE_POINTS + SPEED_BONUS * frac) * mult * (BOSS_MULT if boss else 1.0))
    return pts + (SHOVEL_BONUS if shovel else 0)


def make_groups(uids: list[int], rng: random.Random) -> dict[int, int]:
    """Grupos de 3; resto 1 entra no último grupo (vira 4); resto 2 forma grupo de 2."""
    ids = uids[:]
    rng.shuffle(ids)
    chunks = [ids[i : i + 3] for i in range(0, len(ids), 3)]
    if len(chunks) > 1 and len(chunks[-1]) == 1:
        chunks[-2].extend(chunks.pop())
    return {uid: gi + 1 for gi, chunk in enumerate(chunks) for uid in chunk}


@dataclass
class Rec:
    value: Any
    correct: bool
    time_ms: int
    points: int


@dataclass
class Player:
    uid: int
    nickname: str
    appearance: dict
    tools: list
    xp_base: int = 0
    group: int | None = None
    conns: list = field(default_factory=list)
    used: dict = field(default_factory=dict)  # nº da missão -> set de ferramentas usadas
    fx: dict = field(default_factory=dict)  # efeitos de ferramenta na pergunta atual
    xp: int = 0  # XP ganho nesta sessão
    reward: bool = False

    @property
    def connected(self) -> bool:
        return bool(self.conns)


async def _send(ws, payload: dict) -> bool:
    try:
        await ws.send_json(payload)
        return True
    except Exception:  # noqa: BLE001  (conexão caída: o chamador remove o socket)
        return False


class Room:
    def __init__(self, code: str, session_id: int, era_id: str = "era1") -> None:
        self.code = code
        self.session_id = session_id
        self.era = load_era(era_id)
        self.missions: list[dict] = self.era["missions"]
        self.players: dict[int, Player] = {}
        self.tutors: dict[int, Player] = {}
        self.phase = "lobby"
        self.mi = 0
        self.qi = 0
        self.mult = 1.0  # multiplicador aplicado às próximas perguntas
        self.cur_mult = 1.0
        self.auto = True
        self.paused = False
        self.groups_made = False
        self.answers: dict[str, dict[int, Rec]] = {}
        self.q_limit = 30
        self.q_started = 0.0
        self.q_deadline = 0.0
        self.paused_at = 0.0
        self.lantern_extended = False
        self.xp_awarded: set[int] = set()
        self.group_unlocked: set[int] = set()
        self.feedback: dict[int, dict] = {}
        self.podium: dict | None = None
        self.saved_groups: dict[int, int] = {}
        self.lock = asyncio.Lock()
        self._task: asyncio.Task | None = None
        self._gen = 0
        self._unlock_last: dict[int, float] = {}
        self._rng = random.Random()

    # ------------------------------------------------------------------ helpers
    @property
    def mission(self) -> dict:
        return self.missions[self.mi]

    @property
    def question(self) -> dict:
        return self.mission["questions"][self.qi]

    def _perm(self, q: dict) -> list[int]:
        """Ordem de apresentação (embaralhada por sala+pergunta, estável)."""
        n = len(q["options"] if q["type"] == "mc" else q["items"])
        idx = list(range(n))
        random.Random(f"{self.code}:{q['id']}").shuffle(idx)
        return idx

    def _correct_presented(self, q: dict):
        if q["type"] == "mc":
            return self._perm(q).index(q["answer"])
        return list(range(len(q["items"])))  # índices originais na ordem certa

    def _present(self, q: dict, tutor: bool = False) -> dict:
        perm = self._perm(q)
        base = {
            "id": q["id"],
            "type": q["type"],
            "prompt": q["prompt"],
            "seconds": q.get("seconds", 30),
            "boss": bool(self.mission.get("boss")),
        }
        if q["type"] == "mc":
            base["options"] = [q["options"][i] for i in perm]
        else:
            base["items"] = [{"i": i, "text": q["items"][i]} for i in perm]
        if tutor:
            base["correct"] = self._correct_presented(q)
            base["difficulty"] = q["difficulty"]
            base["explanation"] = q["explanation"]
        return base

    def players_in(self, g: int) -> list[Player]:
        return [p for p in self.players.values() if p.group == g]

    def group_ids(self) -> list[int]:
        return sorted({p.group for p in self.players.values() if p.group is not None})

    def total_points(self, uid: int) -> int:
        return sum(r[uid].points for r in self.answers.values() if uid in r)

    def mission_points(self, uid: int, mission: dict) -> int:
        return sum(
            self.answers.get(q["id"], {}).get(uid, Rec(None, False, 0, 0)).points
            for q in mission["questions"]
        )

    def _group_q(self, g: int, qid: str) -> int:
        members = self.players_in(g)
        if not members:
            return 0
        recs = [self.answers.get(qid, {}).get(p.uid) for p in members]
        avg = sum(r.points for r in recs if r) / len(members)
        combo = COMBO_BONUS if all(r and r.correct for r in recs) else 0
        return round(avg * 3) + combo

    def group_points(self, g: int, mission: dict | None = None) -> int:
        missions = [mission] if mission else self.missions
        return sum(self._group_q(g, q["id"]) for m in missions for q in m["questions"] if q["id"] in self.answers)

    # ----------------------------------------------------------------- timers
    def _cancel(self) -> None:
        self._gen += 1
        t = self._task
        if t and not t.done() and t is not asyncio.current_task():
            t.cancel()
        self._task = None

    def _schedule(self, delay: float, fn) -> None:
        self._cancel()
        gen = self._gen

        async def run():
            await asyncio.sleep(max(0.0, delay))
            async with self.lock:
                if gen != self._gen:
                    return
                await fn()

        self._task = asyncio.create_task(run())

    # ----------------------------------------------------------- connections
    async def join(self, ws, user_id: int, nickname: str, role: str, appearance: dict, tools: list,
                   xp_base: int) -> None:
        async with self.lock:
            if role == "tutor":
                t = self.tutors.setdefault(user_id, Player(user_id, nickname, appearance, tools))
                t.conns.append(ws)
            else:
                p = self.players.get(user_id)
                if p is None:
                    p = Player(user_id, nickname, appearance, tools, xp_base=xp_base)
                    self.players[user_id] = p
                    if user_id in self.saved_groups:
                        p.group = self.saved_groups[user_id]
                    elif self.groups_made:
                        p.group = self._smallest_group()
                else:
                    p.nickname, p.appearance, p.tools = nickname, appearance, tools
                p.conns.append(ws)
            await self._broadcast()

    def _smallest_group(self) -> int:
        ids = self.group_ids() or [1]
        return min(ids, key=lambda g: len(self.players_in(g)))

    async def leave(self, ws, user_id: int, role: str) -> None:
        async with self.lock:
            holder = self.tutors if role == "tutor" else self.players
            p = holder.get(user_id)
            if p and ws in p.conns:
                p.conns.remove(ws)
            # se faltava só quem saiu, encerra a pergunta
            if self.phase == "question" and not self.paused and self._all_answered():
                await self._end_question()
            else:
                await self._broadcast()

    # ---------------------------------------------------------------- handlers
    async def handle(self, user_id: int, role: str, msg: dict) -> None:
        t = msg.get("t")
        async with self.lock:
            if role == "tutor":
                if t == "tutor":
                    await self._tutor_cmd(user_id, msg)
                return
            p = self.players.get(user_id)
            if p is None:
                return
            if t == "answer":
                await self._answer(p, msg)
            elif t == "tool":
                await self._use_tool(p, msg)
            elif t == "unlock":
                await self._unlock(p, msg)

    async def _error(self, p: Player, text: str) -> None:
        for ws in list(p.conns):
            await _send(ws, {"t": "error", "msg": text})

    # --- tutor
    async def _tutor_cmd(self, uid: int, msg: dict) -> None:
        cmd = msg.get("cmd")
        if cmd == "groups" and self.phase == "lobby":
            self._assign_groups()
            await self._save()
            await self._broadcast()
        elif cmd == "start" and self.phase == "lobby":
            if not self.players:
                return
            if not self.groups_made:
                self._assign_groups()
            self.phase, self.mi, self.qi = "intro", 0, 0
            await self._save()
            await self._broadcast()
        elif cmd == "next":
            await self._next()
        elif cmd == "reveal" and self.phase == "question":
            await self._end_question()
        elif cmd == "pause" and not self.paused and self.phase in ("question", "reveal"):
            self.paused = True
            self.paused_at = time.monotonic()
            self._cancel()
            await self._broadcast()
        elif cmd == "resume" and self.paused:
            shift = time.monotonic() - self.paused_at
            self.paused = False
            if self.phase == "question":
                self.q_started += shift
                self.q_deadline += shift
                self._schedule(self.q_deadline - time.monotonic(), self._end_question)
            elif self.phase == "reveal" and self.auto:
                self._schedule(REVEAL_AUTO_S, self._advance)
            await self._broadcast()
        elif cmd == "mult" and msg.get("value") in (1, 1.5, 2):
            self.mult = float(msg["value"])
            await self._broadcast()
        elif cmd == "auto":
            self.auto = bool(msg.get("value"))
            if not self.auto and self.phase == "reveal":
                self._cancel()
            await self._broadcast()
        elif cmd == "finish" and self.phase != "finished":
            self.phase = "finished"
            self._cancel()
            await self._save(status="finished")
            await self._broadcast()

    def _assign_groups(self) -> None:
        mapping = make_groups(list(self.players), self._rng)
        for uid, g in mapping.items():
            self.players[uid].group = g
        self.groups_made = True

    async def _next(self) -> None:
        if self.paused:
            return
        if self.phase == "intro":
            await self._begin_question()
        elif self.phase == "reveal":
            await self._advance()
        elif self.phase == "podium":
            if self.mi + 1 < len(self.missions):
                self.mi, self.qi, self.phase = self.mi + 1, 0, "intro"
            else:
                self.phase = "unlock"
            self._cancel()
            await self._save()
            await self._broadcast()

    # --- perguntas
    async def _begin_question(self) -> None:
        q = self.question
        self.phase = "question"
        self.q_limit = q.get("seconds", 30)
        self.q_started = time.monotonic()
        self.q_deadline = self.q_started + self.q_limit
        self.cur_mult = self.mult
        self.lantern_extended = False
        self.answers.setdefault(q["id"], {})
        for p in self.players.values():
            p.fx = {}
        self._schedule(self.q_limit, self._end_question)
        await self._save()
        await self._broadcast()

    def _connected_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.connected]

    def _all_answered(self) -> bool:
        conn = self._connected_players()
        done = self.answers.get(self.question["id"], {})
        return bool(conn) and all(p.uid in done for p in conn)

    async def _end_question(self) -> None:
        if self.phase != "question":
            return
        self.phase = "reveal"
        self._cancel()
        if self.auto and not self.paused:
            self._schedule(REVEAL_AUTO_S, self._advance)
        await self._save()
        await self._broadcast()

    async def _advance(self) -> None:
        if self.phase != "reveal":
            return
        if self.qi + 1 < len(self.mission["questions"]):
            self.qi += 1
            await self._begin_question()
        else:
            await self._go_podium()

    async def _go_podium(self) -> None:
        self._cancel()
        m = self.mission
        no = m["no"]
        gain: dict[int, int] = {}
        if no not in self.xp_awarded:
            self.xp_awarded.add(no)
            async with session_maker()() as db:
                for p in self.players.values():
                    answered = any(p.uid in self.answers.get(q["id"], {}) for q in m["questions"])
                    if not answered:
                        continue
                    xp = round(self.mission_points(p.uid, m) / 10) + MISSION_XP
                    gain[p.uid] = xp
                    p.xp += xp
                    db.add(XpLedger(user_id=p.uid, session_id=self.session_id, source=f"mission{no}", xp=xp))
                await db.commit()
        ind = sorted(self.players.values(), key=lambda p: (-self.mission_points(p.uid, m), p.nickname.lower()))
        gs = sorted(self.group_ids(), key=lambda g: -self.group_points(g, m))
        self.podium = {
            "mission": no,
            "individuals": [
                {"nickname": p.nickname, "appearance": p.appearance, "points": self.mission_points(p.uid, m)}
                for p in ind[:3]
            ],
            "groups": [self._group_card(g, self.group_points(g, m)) for g in gs[:3]],
            "xp_gain": gain,
        }
        self.phase = "podium"
        await self._save()
        await self._broadcast()

    def _group_card(self, g: int, points: int) -> dict:
        return {
            "no": g,
            "name": GROUP_NAMES[(g - 1) % len(GROUP_NAMES)],
            "points": points,
            "members": [{"nickname": p.nickname, "appearance": p.appearance} for p in self.players_in(g)],
            "unlocked": g in self.group_unlocked,
        }

    # --- respostas
    async def _answer(self, p: Player, msg: dict) -> None:
        if self.phase != "question" or self.paused:
            return await self._error(p, "Não há pergunta aberta agora.")
        q = self.question
        if msg.get("qid") != q["id"]:
            return await self._error(p, "Essa pergunta já passou.")
        recs = self.answers.setdefault(q["id"], {})
        if p.uid in recs:
            return
        now = time.monotonic()
        if now > self.q_deadline + GRACE_S:
            return await self._error(p, "O tempo acabou.")
        value = msg.get("value")
        n = len(q["options"] if q["type"] == "mc" else q["items"])
        if q["type"] == "mc":
            if not isinstance(value, int) or isinstance(value, bool) or not 0 <= value < n:
                return await self._error(p, "Resposta inválida.")
            correct = value == self._correct_presented(q)
        else:
            if not isinstance(value, list) or sorted(value) != list(range(n)):
                return await self._error(p, "Resposta inválida.")
            correct = value == list(range(n))
        elapsed = max(0.0, now - self.q_started)
        limit = self.q_limit + (LANTERN_S if p.fx.get("lantern") else 0)
        pts = score_answer(
            correct, elapsed, limit, self.cur_mult, bool(self.mission.get("boss")), bool(p.fx.get("shovel"))
        )
        rec = Rec(value, correct, int(elapsed * 1000), pts)
        recs[p.uid] = rec
        async with session_maker()() as db:
            db.add(
                Answer(
                    session_id=self.session_id, user_id=p.uid, question_id=q["id"],
                    mission=self.mission["no"], value={"v": value}, correct=correct,
                    time_ms=rec.time_ms, points=pts,
                )
            )
            await db.commit()
        if self._all_answered():
            await self._end_question()
        else:
            await self._broadcast()

    async def _use_tool(self, p: Player, msg: dict) -> None:
        tool = msg.get("tool")
        if self.phase != "question" or self.paused:
            return await self._error(p, "Ferramentas só funcionam durante uma pergunta.")
        q = self.question
        if p.uid in self.answers.get(q["id"], {}):
            return await self._error(p, "Você já respondeu esta pergunta.")
        if tool not in p.tools:
            return await self._error(p, "Você não escolheu essa ferramenta.")
        used = p.used.setdefault(self.mission["no"], set())
        if tool in used:
            return await self._error(p, "Essa ferramenta já foi usada nesta missão.")
        if tool == "livro":
            p.fx["hint"] = q.get("hint", "")
        elif tool == "gibi":
            p.fx["comic"] = q.get("comic", "")
        elif tool == "lupa":
            if q["type"] != "mc":
                return await self._error(p, "A Lupa só funciona em perguntas de alternativas.")
            correct = self._correct_presented(q)
            wrong = [i for i in range(len(q["options"])) if i != correct]
            p.fx["eliminated"] = random.Random(f"{self.code}:{q['id']}:{p.uid}").choice(wrong)
        elif tool == "lanterna":
            p.fx["lantern"] = True
            if not self.lantern_extended:
                self.lantern_extended = True
                self.q_deadline += LANTERN_S
                self._schedule(self.q_deadline - time.monotonic(), self._end_question)
        elif tool == "pa":
            p.fx["shovel"] = True
        elif tool == "bussola":
            p.fx["difficulty"] = q["difficulty"]
        used.add(tool)
        await self._broadcast()

    # --- desbloqueio da Era
    async def _unlock(self, p: Player, msg: dict) -> None:
        if self.phase != "unlock" or p.group is None:
            return await self._error(p, "O selo ainda não está disponível.")
        g = p.group
        if g in self.group_unlocked:
            return
        blanks = self.era["unlock"]["blanks"]
        words = msg.get("words")
        if not isinstance(words, list) or len(words) != len(blanks) or not all(
            isinstance(w, str) and len(w) <= 24 for w in words
        ):
            return await self._error(p, "Preencha todas as lacunas.")
        now = time.monotonic()
        if now - self._unlock_last.get(g, -99) < UNLOCK_COOLDOWN_S:
            return await self._error(p, "Esperem alguns segundos antes de tentar de novo.")
        self._unlock_last[g] = now
        ok = [norm(w) in {norm(a) for a in b["accept"]} for w, b in zip(words, blanks, strict=True)]
        n = sum(ok)
        digest = hashlib.sha256("|".join(norm(w) for w in words).encode()).hexdigest()
        reward_item = self.era["reward"]["item"]
        async with session_maker()() as db:
            db.add(UnlockAttempt(session_id=self.session_id, group_no=g, attempt_hash=digest,
                                 correct_blanks=n, ok=n == len(blanks)))
            if n == len(blanks):
                for m in self.players_in(g):
                    db.add(XpLedger(user_id=m.uid, session_id=self.session_id, source="unlock", xp=UNLOCK_XP))
                    ch = await db.get(Character, m.uid)
                    if ch is not None and reward_item not in (ch.unlocked or []):
                        ch.unlocked = [*(ch.unlocked or []), reward_item]
                    m.xp += UNLOCK_XP
                    m.reward = True
            await db.commit()
        if n == len(blanks):
            self.group_unlocked.add(g)
            self.feedback[g] = {"correct": n, "total": len(blanks), "by": p.nickname, "ok": True}
        else:
            self.feedback[g] = {"correct": n, "total": len(blanks), "by": p.nickname, "ok": False}
        await self._save()
        await self._broadcast()

    # ------------------------------------------------------------- persistência
    def snapshot(self) -> dict:
        return {
            "phase": self.phase, "mi": self.mi, "qi": self.qi, "mult": self.mult, "auto": self.auto,
            "groups_made": self.groups_made,
            "groups": {str(p.uid): p.group for p in self.players.values() if p.group is not None},
            "xp_awarded": sorted(self.xp_awarded), "unlocked": sorted(self.group_unlocked),
        }

    async def _save(self, status: str | None = None) -> None:
        async with session_maker()() as db:
            gs = await db.get(GameSession, self.session_id)
            if gs is None:
                return
            gs.state = self.snapshot()
            if status:
                gs.status = status
            await db.commit()

    async def restore(self) -> None:
        async with session_maker()() as db:
            gs = await db.get(GameSession, self.session_id)
            st = (gs.state if gs else None) or {}
            rows = (await db.execute(select(Answer).where(Answer.session_id == self.session_id))).scalars()
            for a in rows:
                self.answers.setdefault(a.question_id, {})[a.user_id] = Rec(
                    a.value.get("v"), a.correct, a.time_ms, a.points
                )
        if not st:
            return
        self.phase = st.get("phase", "lobby")
        self.mi, self.qi = st.get("mi", 0), st.get("qi", 0)
        self.mult, self.auto = st.get("mult", 1.0), st.get("auto", True)
        self.groups_made = st.get("groups_made", False)
        self.saved_groups = {int(k): v for k, v in st.get("groups", {}).items()}
        self.xp_awarded = set(st.get("xp_awarded", []))
        self.group_unlocked = set(st.get("unlocked", []))
        if self.phase == "question":  # reinício do servidor: reabre a pergunta com tempo cheio
            await self._begin_question_locked_restore()
        elif self.phase == "podium":
            self.phase = "reveal"  # evita recalcular o pódio sem os jogadores; tutor avança

    async def _begin_question_locked_restore(self) -> None:
        q = self.question
        self.q_limit = q.get("seconds", 30)
        self.q_started = time.monotonic()
        self.q_deadline = self.q_started + self.q_limit
        self.cur_mult = self.mult
        self._schedule(self.q_limit, self._end_question)

    # ------------------------------------------------------------------ views
    async def _broadcast(self) -> None:
        dead: list[tuple[Player, Any]] = []
        for holder, is_tutor in ((self.players, False), (self.tutors, True)):
            for p in list(holder.values()):
                if not p.conns:
                    continue
                view = self.view(p.uid, is_tutor)
                for ws in list(p.conns):
                    if not await _send(ws, view):
                        dead.append((p, ws))
        for p, ws in dead:
            if ws in p.conns:
                p.conns.remove(ws)

    def _leaderboard(self, limit: int = 8) -> list[dict]:
        rows = sorted(self.players.values(), key=lambda p: (-self.total_points(p.uid), p.nickname.lower()))
        return [
            {"nickname": p.nickname, "appearance": p.appearance, "points": self.total_points(p.uid)}
            for p in rows[:limit]
        ]

    def view(self, uid: int, tutor: bool) -> dict:
        now = time.monotonic()
        m = self.mission if self.phase != "lobby" else None
        v: dict[str, Any] = {
            "t": "state",
            "code": self.code,
            "phase": self.phase,
            "paused": self.paused,
            "era": {"title": self.era["title"], "missions": len(self.missions)},
            "mission": (
                {"no": m["no"], "name": m["name"], "pillar": m["pillar"], "intro": m["intro"],
                 "boss": bool(m.get("boss")), "questions": len(m["questions"])}
                if m else None
            ),
            "qindex": self.qi,
            "mult": self.mult,
            "auto": self.auto,
            "players": len(self.players),
            "connected": len(self._connected_players()),
            "leaderboard": self._leaderboard(),
            "groups": [self._group_card(g, self.group_points(g)) for g in self.group_ids()],
        }
        if self.phase in ("question", "reveal"):
            q = self.question
            recs = self.answers.get(q["id"], {})
            v["answered"] = len(recs)
            if self.phase == "question":
                end = self.paused_at if self.paused else now
                v["remaining_ms"] = max(0, int((self.q_deadline - end) * 1000))
                v["total_ms"] = int(self.q_limit * 1000)
                v["mult_now"] = self.cur_mult
            v["question"] = self._present(q, tutor=tutor)
            if self.phase == "question" and not tutor:
                v["question"].pop("explanation", None)
        if self.phase == "reveal":
            q = self.question
            v["reveal"] = {
                "correct": self._correct_presented(q),
                "explanation": q["explanation"],
            }
            if q["type"] == "mc":
                counts = [0] * len(q["options"])
                for r in self.answers.get(q["id"], {}).values():
                    if isinstance(r.value, int):
                        counts[r.value] += 1
                v["reveal"]["counts"] = counts
        if self.phase == "podium" and self.podium:
            v["podium"] = {k: val for k, val in self.podium.items() if k != "xp_gain"}
        if self.phase in ("unlock", "finished"):
            u = self.era["unlock"]
            v["unlock"] = {"template": u["template"], "blanks": [b["label"] for b in u["blanks"]]}
        if tutor:
            v["role"] = "tutor"
            v["tutor"] = {
                "players": [
                    {"uid": p.uid, "nickname": p.nickname, "group": p.group, "connected": p.connected,
                     "answered": self.phase == "question" and p.uid in self.answers.get(self.question["id"], {}),
                     "points": self.total_points(p.uid)}
                    for p in sorted(self.players.values(), key=lambda p: p.nickname.lower())
                ],
                "secret": [b["accept"][0] for b in self.era["unlock"]["blanks"]],
            }
        else:
            v["role"] = "student"
            v["me"] = self._me_view(uid)
        return v

    def _me_view(self, uid: int) -> dict:
        p = self.players[uid]
        me: dict[str, Any] = {
            "uid": uid, "nickname": p.nickname, "appearance": p.appearance, "tools": p.tools,
            "group": p.group, "points": self.total_points(uid), "xp": p.xp, "level": level_for(p.xp_base + p.xp),
        }
        ranking = sorted(self.players, key=lambda u: (-self.total_points(u), self.players[u].nickname.lower()))
        me["rank"] = ranking.index(uid) + 1
        if self.phase in ("question", "reveal"):
            q = self.question
            rec = self.answers.get(q["id"], {}).get(uid)
            me["answered"] = rec is not None
            if rec is not None and self.phase == "question":
                me["my_value"] = rec.value
            if self.phase == "reveal":
                me["result"] = {"answered": rec is not None, "correct": bool(rec and rec.correct),
                                "points": rec.points if rec else 0, "value": rec.value if rec else None}
            me["fx"] = dict(p.fx)
            used = p.used.get(self.mission["no"], set())
            me["tools_left"] = [t for t in p.tools if t not in used]
        if self.phase == "podium" and self.podium:
            me["mission_points"] = self.mission_points(uid, self.mission)
            me["xp_gain"] = self.podium["xp_gain"].get(uid, 0)
        if self.phase in ("unlock", "finished") and p.group is not None:
            g = p.group
            me["unlock"] = {"ok": g in self.group_unlocked, "feedback": self.feedback.get(g)}
            if g in self.group_unlocked:
                r = self.era["reward"]
                me["unlock"]["reward"] = {"title": r["title"], "text": r["text"], "item": r["item"]}
        return me


class Hub:
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self._lock = asyncio.Lock()

    async def get_room(self, code: str) -> Room | None:
        async with self._lock:
            room = self.rooms.get(code)
            if room:
                return room
            async with session_maker()() as db:
                gs = (await db.execute(select(GameSession).where(GameSession.code == code))).scalar_one_or_none()
            if gs is None or gs.status != "open":
                return None
            room = Room(gs.code, gs.id, gs.era_id)
            await room.restore()
            self.rooms[code] = room
            return room

    async def xp_total(self, uid: int) -> int:
        async with session_maker()() as db:
            return (
                await db.execute(select(func.coalesce(func.sum(XpLedger.xp), 0)).where(XpLedger.user_id == uid))
            ).scalar_one()


hub = Hub()
__all__ = ["Hub", "Room", "catalog", "hub", "level_for", "make_groups", "score_answer"]

"""Aula simulada: 7 alunos + 1 tutor jogam a Era 1 inteira contra o motor (sem rede)."""

import asyncio

from app.game import engine
from app.game.engine import Room
from app.models import Character, GameSession, User

TOOLS = ["livro", "lupa"]


async def make_room(app_db, n_students=7):
    from app import db as dbm

    async with dbm.session_maker()() as s:
        tutor = User(email="t@x.com", password_hash="x", nickname="Emily", role="tutor")
        s.add(tutor)
        await s.flush()
        gs = GameSession(code="ABC234", tutor_id=tutor.id, era_id="era1", status="open", state={})
        s.add(gs)
        studs = []
        for i in range(n_students):
            u = User(email=f"s{i}@x.com", password_hash="x", nickname=f"Aluno{i}", role="student")
            s.add(u)
            await s.flush()
            s.add(Character(user_id=u.id, appearance={"cls": "robo", "color": "coral"}, tools=list(TOOLS), unlocked=[]))
            studs.append(u)
        await s.commit()
        room = Room("ABC234", gs.id)
    return room, tutor, studs


async def connect_all(room, tutor, studs, FakeWS):
    tws = FakeWS()
    await room.join(tws, tutor.id, tutor.nickname, "tutor", {}, [], 0)
    sws = {}
    for u in studs:
        ws = FakeWS()
        sws[u.id] = ws
        await room.join(ws, u.id, u.nickname, "student", {"cls": "robo", "color": "coral"}, list(TOOLS), 0)
    return tws, sws


def correct_value(room, q):
    return room._correct_presented(q)


async def play_question(room, studs, sws, right_for=lambda u: True):
    q = room.question
    for u in studs:
        val = correct_value(room, q)
        if not right_for(u):
            val = (val + 1) % len(q["options"]) if q["type"] == "mc" else list(reversed(val))
        await room.handle(u.id, "student", {"t": "answer", "qid": q["id"], "value": val})


async def test_full_class(app_db, fakews, monkeypatch):
    monkeypatch.setattr(engine, "REVEAL_AUTO_S", 0.01)
    room, tutor, studs = await make_room(app_db)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    assert tws.state["phase"] == "lobby" and tws.state["players"] == 7

    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "groups"})
    sizes = sorted(len(room.players_in(g)) for g in room.group_ids())
    assert sizes == [3, 4]
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    assert room.phase == "intro" and room.mission["no"] == 1

    for mission in room.missions:
        assert room.phase == "intro"
        await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
        for _ in mission["questions"]:
            assert room.phase == "question"
            await play_question(room, studs, sws, right_for=lambda u: u.id % 2 == 0 or room.mi > 1)
            assert room.phase == "reveal"
            await asyncio.sleep(0.05)  # avanço automático
        assert room.phase == "podium"
        v = sws[studs[0].id].state
        assert v["podium"]["individuals"] and v["me"]["xp_gain"] >= engine.MISSION_XP
        await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})

    assert room.phase == "unlock"
    # tentativa errada, depois certa
    g = room.players[studs[0].id].group
    bad = studs[0]
    await room.handle(bad.id, "student", {"t": "unlock", "words": ["a", "b", "c", "d"]})
    fb = sws[bad.id].state["me"]["unlock"]["feedback"]
    assert fb["correct"] == 0 and not fb["ok"]
    assert "reward" not in sws[bad.id].state["me"]["unlock"]
    room._unlock_last.clear()
    await room.handle(bad.id, "student", {"t": "unlock", "words": ["Dividir", "PADRÃO", "essencial", "passos"]})
    unl = sws[bad.id].state["me"]["unlock"]
    assert unl["ok"] and unl["reward"]["item"] == "capa_cartografo"
    # outro grupo continua trancado
    other = next(u for u in studs if room.players[u.id].group != g)
    assert sws[other.id].state["me"]["unlock"]["ok"] is False

    from app import db as dbm
    async with dbm.session_maker()() as s:
        ch = await s.get(Character, bad.id)
        assert "capa_cartografo" in ch.unlocked
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "finish"})
    assert room.phase == "finished"
    async with dbm.session_maker()() as s:
        assert (await s.get(GameSession, room.session_id)).status == "finished"


async def test_no_answer_leak_to_students(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 3)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    import json
    blob = json.dumps(sws[studs[0].id].state)
    q = room.question
    assert "correct" not in sws[studs[0].id].state["question"]
    assert "explanation" not in sws[studs[0].id].state["question"]
    assert "reveal" not in sws[studs[0].id].state
    assert q["explanation"] not in blob
    assert "correct" in tws.state["question"]  # tutor vê
    assert "secret" in tws.state["tutor"] and "secret" not in blob


async def test_double_answer_and_late_and_invalid(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 3)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    q = room.question
    u = studs[0]
    await room.handle(u.id, "student", {"t": "answer", "qid": q["id"], "value": 99})
    assert "Resposta inválida." in sws[u.id].errors
    right = correct_value(room, q)
    await room.handle(u.id, "student", {"t": "answer", "qid": q["id"], "value": right})
    first = room.answers[q["id"]][u.id].points
    wrong = (right + 1) % len(q["options"])
    await room.handle(u.id, "student", {"t": "answer", "qid": q["id"], "value": wrong})
    assert room.answers[q["id"]][u.id].points == first  # segunda resposta ignorada
    await room.handle(studs[1].id, "student", {"t": "answer", "qid": "m9q9", "value": 0})
    assert "Essa pergunta já passou." in sws[studs[1].id].errors
    room.q_deadline = engine.time.monotonic() - engine.GRACE_S - 1
    await room.handle(studs[1].id, "student", {"t": "answer", "qid": q["id"], "value": right})
    assert "O tempo acabou." in sws[studs[1].id].errors
    room._cancel()


async def test_tools_rules(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 3)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    u = studs[0]
    await room.handle(u.id, "student", {"t": "tool", "tool": "bussola"})
    assert "Você não escolheu essa ferramenta." in sws[u.id].errors
    await room.handle(u.id, "student", {"t": "tool", "tool": "lupa"})
    fx = sws[u.id].state["me"]["fx"]
    assert fx["eliminated"] != correct_value(room, room.question)
    assert "lupa" not in sws[u.id].state["me"]["tools_left"]
    await room.handle(u.id, "student", {"t": "tool", "tool": "lupa"})
    assert "Essa ferramenta já foi usada nesta missão." in sws[u.id].errors
    await room.handle(u.id, "student", {"t": "tool", "tool": "livro"})
    assert sws[u.id].state["me"]["fx"]["hint"]
    room._cancel()


async def test_pause_freezes_timer(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 2)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "pause"})
    r1 = sws[studs[0].id].state["remaining_ms"]
    await asyncio.sleep(0.2)
    await room._broadcast()
    assert sws[studs[0].id].state["remaining_ms"] == r1
    q = room.question
    await room.handle(studs[0].id, "student", {"t": "answer", "qid": q["id"], "value": 0})
    assert q["id"] not in room.answers or studs[0].id not in room.answers[q["id"]]
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "resume"})
    assert not room.paused
    room._cancel()


async def test_group_scoring_with_combo(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 3)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    await play_question(room, studs, sws)
    g = room.players[studs[0].id].group
    pts = [room.answers[room.question["id"]][u.id].points for u in studs]
    assert room.group_points(g) == round(sum(pts) / 3 * 3) + engine.COMBO_BONUS
    room._cancel()


async def test_late_joiner_gets_smallest_group_and_reconnect(app_db, fakews):
    room, tutor, studs = await make_room(app_db, 4)
    tws, sws = await connect_all(room, tutor, studs[:3], fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    late = studs[3]
    ws = fakews()
    await room.join(ws, late.id, late.nickname, "student", {"cls": "robo", "color": "coral"}, list(TOOLS), 0)
    assert room.players[late.id].group in room.group_ids()
    ws2 = fakews()  # reconexão (nova aba) mantém o mesmo jogador
    await room.join(ws2, late.id, late.nickname, "student", {"cls": "robo", "color": "coral"}, list(TOOLS), 0)
    assert len(room.players) == 4 and len(room.players[late.id].conns) == 2
    await room.leave(ws, late.id, "student")
    assert len(room.players[late.id].conns) == 1


async def test_restore_after_restart_keeps_answers_and_groups(app_db, fakews):
    from app.game.engine import Room

    room, tutor, studs = await make_room(app_db, 3)
    tws, sws = await connect_all(room, tutor, studs, fakews)
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "start"})
    await room.handle(tutor.id, "tutor", {"t": "tutor", "cmd": "next"})
    await room.handle(studs[0].id, "student", {"t": "answer", "qid": room.question["id"], "value": correct_value(room, room.question)})
    pts = room.answers[room.question["id"]][studs[0].id].points
    groups = {uid: p.group for uid, p in room.players.items()}
    room._cancel()
    # "reinício do servidor"
    room2 = Room("ABC234", room.session_id)
    await room2.restore()
    assert room2.phase == "question"
    assert room2.answers[room.question["id"]][studs[0].id].points == pts
    ws = fakews()
    await room2.join(ws, studs[0].id, "Aluno0", "student", {"cls": "robo", "color": "coral"}, list(TOOLS), 0)
    assert room2.players[studs[0].id].group == groups[studs[0].id]
    assert ws.state["me"]["answered"] is True
    room2._cancel()

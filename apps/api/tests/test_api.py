
CHAR = {
    "appearance": {"cls": "heroi", "color": "pele5", "hair_style": "cacheado", "hair_color": "preto", "accessories": ["capa"]},
    "tools": ["livro", "lupa"],
    "scenario": "floresta",
    "world": "luzes",
}


async def register(client, email="a@gmail.com", nick="Ana", code="TURMA-TESTE", pw="senha1234"):
    return await client.post("/api/auth/register", json={"email": email, "password": pw, "nickname": nick, "code": code})


async def test_register_wrong_code_rejected(client):
    r = await register(client, code="ERRADO")
    assert r.status_code == 403


async def test_register_login_persistence_flow(client):
    r = await register(client)
    assert r.status_code == 201 and r.json()["role"] == "student"
    me = (await client.get("/api/me")).json()
    assert me["nickname"] == "Ana" and me["onboarding_done"] is False and me["level"] == 1
    # persistência: salva o Edu, faz logout, entra de novo
    assert (await client.put("/api/me/character", json=CHAR)).status_code == 200
    await client.post("/api/auth/logout")
    assert (await client.get("/api/me")).status_code == 401
    r = await client.post("/api/auth/login", json={"email": "A@Gmail.com", "password": "senha1234"})
    assert r.status_code == 200
    me = (await client.get("/api/me")).json()
    assert me["onboarding_done"] is True
    assert me["character"]["appearance"]["cls"] == "heroi"
    assert "email" not in me


async def test_duplicate_email_and_bad_login(client):
    await register(client)
    assert (await register(client)).status_code == 409
    r = await client.post("/api/auth/login", json={"email": "a@gmail.com", "password": "errada123"})
    assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"email": "nao@existe.com", "password": "errada123"})
    assert r.status_code == 401 and r.json()["detail"] == "E-mail ou senha incorretos."


async def test_password_and_email_validation(client):
    assert (await register(client, pw="curta")).status_code == 422
    assert (await register(client, email="sem-arroba")).status_code == 422
    assert (await register(client, nick="x")).status_code == 422


async def test_login_rate_limit(client):
    await register(client)
    codes = []
    for _ in range(12):
        r = await client.post("/api/auth/login", json={"email": "a@gmail.com", "password": "errada123"})
        codes.append(r.status_code)
    assert codes[:10] == [401] * 10 and 429 in codes[10:]


async def test_character_validation_error(client):
    await register(client)
    bad = {**CHAR, "tools": ["livro"]}
    r = await client.put("/api/me/character", json=bad)
    assert r.status_code == 422


async def test_sessions_only_tutors(client):
    await register(client)
    assert (await client.post("/api/sessions")).status_code == 403
    await client.post("/api/auth/logout")
    r = await register(client, email="t@gmail.com", nick="Emily", code="TUTOR-TESTE")
    assert r.json()["role"] == "tutor"
    r = await client.post("/api/sessions")
    assert r.status_code == 201
    code = r.json()["code"]
    assert len(code) == 6 and code.isalnum()
    assert (await client.get(f"/api/sessions/{code.lower()}")).status_code == 200
    assert (await client.get("/api/sessions/ZZZZZZ")).status_code == 404


async def test_unauthenticated_endpoints(client):
    assert (await client.get("/api/me")).status_code == 401
    assert (await client.get("/api/catalog")).status_code == 200
    assert (await client.get("/api/health")).json() == {"ok": True}


async def test_cookie_flags(client):
    r = await register(client)
    sc = r.headers["set-cookie"].lower()
    assert "httponly" in sc and "samesite=lax" in sc

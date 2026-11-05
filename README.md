# Aventuras do Edu — EduCode Marabá

Aventura gamificada ao vivo (Kahoot + RPG) para ensinar Computação a estudantes de 11–12 anos. **Era 1: Pensamento Computacional**, com os tutores Emily, Hernandes e Felipe.

PRD, handover, deploy e histórico de sessões ficam fora deste repositório público.

## Estado desta revisão (04/11/2026)

Alunos entram por PIN/QR e apelido, sem e-mail ou senha. O código pessoal privado recupera o mesmo Edu e progresso em outro aparelho. Tutores têm contas individuais por convite secreto, podem acompanhar a mesma sala e ajudar na recuperação de perfis antigos sem associar contas por apelido.

Validação: 49 testes aprovados em SQLite e PostgreSQL; build/typecheck e ruff aprovados; E2E com 3 tutores + 3 alunos, QR decodificado, 5 missões / 20 perguntas e recuperação entre aparelhos e assistida. Nenhum erro de console ou violação axe nas telas avaliadas (não substitui avaliação manual).

Esta revisão não implica deploy. Autorizações para a atividade são organizadas fora da plataforma, sem coleta de e-mail na entrada do aluno.

## Acesso

- Alunos: `/entrar` com PIN da sala; QR abre `/participar/PIN`. Guardar o código pessoal de 16 caracteres em local seguro; não compartilhar com colegas.
- Tutores: `/professor`, opção **Tenho convite de tutor** para cadastrar e-mail, senha e nome. Felipe define a própria senha; obtenha o convite com Emily por canal privado, nunca pelo PIN público.
- Conta antiga de aluno: o tutor busca o apelido exato em seu painel, identifica o aluno presencialmente e emite um código pessoal. ID, Edu, XP e inventário são preservados. Apelidos repetidos não comprovam identidade. Reemissão invalida o código e as sessões anteriores, inclusive WebSockets.

## Stack

TypeScript + React 19 + Vite (front) · Python 3.12 + FastAPI + SQLAlchemy async (back) · PostgreSQL 16 · WebSocket para o jogo ao vivo.

## Rodar localmente (sem Docker)

- API + Postgres embutido: `cd apps/api && uv venv --python 3.12 && uv pip install -e ".[dev]" pgserver && .venv/bin/python scripts/dev_server.py` (API em `127.0.0.1:8000`, convite exclusivo de ensaio `TUTOR-ENSAIO`). O tutor cria a sala e recebe o PIN dos alunos.
- Front: `cd apps/web && pnpm install --frozen-lockfile && pnpm build` (a API serve `apps/web/dist`) ou `pnpm dev` (`:5173`, proxy para `:8000`). Usar pnpm 10.28.0.
- Testes: `cd apps/api && .venv/bin/pytest`. A migração usa PostgreSQL descartável com pgserver, instalado acima.
- E2E isolado, a partir da raiz e com front compilado: `apps/api/.venv/bin/python apps/api/scripts/verify_e2e.py --postgres-tests`. Usa Chrome no macOS; em Linux, defina `CHROME_PATH=/usr/bin/chromium`. Cria banco/API locais, escolhe porta livre, executa testes e encerra seus processos. Capturas ficam em diretório temporário externo ao repo; códigos pessoais não são registrados nas capturas.
- Alternativa com API de ensaio já ativa: `cd apps/web && CHROME_PATH=/usr/bin/chromium BASE_URL=http://127.0.0.1:8000 node e2e/run.mjs`. O E2E recusa URLs que não sejam loopback.

## Produção

Configure localmente um `.env` com `POSTGRES_PASSWORD`, `AVENTURAS_TUTOR_CODE`, `DOMAIN`, `AVENTURAS_COOKIE_SECURE` e `APP_BIND` (ver `infra/Caddyfile` e `docker-compose.yml`). `.env` e `.env.example` não são distribuídos pelo Git. No VPS com HTTPS, usar `AVENTURAS_COOKIE_SECURE=true` e `APP_BIND=127.0.0.1`. O antigo `AVENTURAS_CLASS_CODE` deixou de ser necessário; `AVENTURAS_TUTOR_CODE` é privado e exclusivo dos tutores.

**Banco existente exige migração antes de usar a nova versão.** `create_all()` não altera colunas antigas. Não apagar tabelas nem recriar volumes.

Para um deploy futuro, em janela de manutenção:
1. Fazer backup protegido fora do repo e verificar que é restaurável.
2. Compilar a nova imagem do app, mantendo o banco existente; parar o app antigo antes da migração.
3. Executar `python scripts/migrate_student_access.py` no ambiente da API configurado para o banco escolhido: por padrão só verifica metadados, sem ler ou exibir credenciais.
4. Revisar o preflight e executar o mesmo comando com `--apply`, se autorizado. A migração é transacional e idempotente, torna e-mail/hash de senha opcionais e cria `student_credentials`; não apaga contas ou progresso.
5. Iniciar o app atualizado e validar tutores, PIN/QR e recuperação. Não fazer rollback cego para a versão que exige e-mail em todos os perfis após criar novos alunos sem e-mail.

Nenhum desses passos de produção é executado pelo ensaio E2E.

## Estrutura

`apps/api` (FastAPI: `app/game/engine.py` é o motor do jogo; `app/content/era1.json` são as perguntas) · `apps/web` (React) · `infra` (Caddy) · `docs` (PRD, handover, sessões).

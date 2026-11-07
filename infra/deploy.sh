#!/usr/bin/env bash
# Deploy no VPS: backup verificado → pull → build → migração PIN/QR → subida → checagens.
# Uso (no VPS, dentro do repo): bash infra/deploy.sh
# Para cada etapa que altera algo, o script pede confirmação. Não rode durante uma aula:
# reiniciar o `app` derruba os WebSockets (as salas voltam do snapshot, mas a pergunta reabre).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose --profile https)
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/aventuras}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/aventuras-$STAMP.dump"
DOMAIN_URL="https://$(grep -E '^DOMAIN=' .env | cut -d= -f2-)"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
confirm() { read -r -p "$1 [s/N] " r; [[ "$r" =~ ^[sS]$ ]] || { echo "Cancelado."; exit 1; }; }

verify_backup() {
  # Recebe o caminho do dump (formato custom do pg_dump) e deve sair com erro
  # (return 1) se o backup não for confiável. Só depois disso o deploy continua.
  local dump="$1"
  [ -s "$dump" ] || { echo "Dump vazio."; return 1; }
  local toc
  toc="$("${COMPOSE[@]}" exec -T db pg_restore -l < "$dump")" || { echo "pg_restore não leu o dump."; return 1; }
  for t in users characters game_sessions session_players answers xp_ledger; do
    grep -q "TABLE DATA public $t " <<<"$toc" || { echo "Tabela ausente no dump: $t"; return 1; }
  done
  local live
  live="$("${COMPOSE[@]}" exec -T db psql -U aventuras -d aventuras -At -c 'select count(*) from users')"
  echo "Dump legível; $live usuários no banco no momento do backup."
}

say "1/7 Estado atual"
git fetch --quiet origin
echo "No VPS:    $(git log -1 --format='%h %ad %s' --date=short)"
echo "No GitHub: $(git log -1 --format='%h %ad %s' --date=short origin/main)"
git log --oneline HEAD..origin/main
"${COMPOSE[@]}" ps --format '{{.Name}}  {{.Status}}'
grep -q '^AVENTURAS_TUTOR_CODE=' .env || { echo "Falta AVENTURAS_TUTOR_CODE no .env"; exit 1; }
grep -q '^APP_BIND=127.0.0.1' .env || echo "AVISO: APP_BIND=127.0.0.1 ausente no .env (porta 8000 exposta)."

say "2/7 Backup do banco → $DUMP"
mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
"${COMPOSE[@]}" exec -T db pg_dump -U aventuras -d aventuras -Fc > "$DUMP"
chmod 600 "$DUMP"
ls -lh "$DUMP"
verify_backup "$DUMP" || { echo "Backup NÃO verificado. Nada foi alterado."; exit 1; }
echo "Backup verificado."

say "3/7 Atualizar código"
confirm "Fazer git pull --ff-only de origin/main?"
git pull --ff-only origin main

say "4/7 Build da nova imagem (o app atual continua no ar)"
"${COMPOSE[@]}" build app

say "5/7 Migração PIN/QR (preflight)"
"${COMPOSE[@]}" run --rm --no-deps app python scripts/migrate_student_access.py
confirm "Aplicar a migração (--apply)? Compatível com a versão antiga do app."
"${COMPOSE[@]}" run --rm --no-deps app python scripts/migrate_student_access.py --apply

say "6/7 Subir a nova versão"
confirm "Reiniciar o app agora (nenhuma aula em andamento)?"
"${COMPOSE[@]}" up -d
sleep 5

say "7/7 Checagens"
curl -fsS "$DOMAIN_URL/api/health" && echo
for p in /entrar /professor /slides; do
  printf '%-11s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "$DOMAIN_URL$p")"
done
echo "Tutores cadastrados (apelido, desde):"
"${COMPOSE[@]}" exec -T db psql -U aventuras -d aventuras -At -F ' · ' \
  -c "select nickname, to_char(created_at, 'DD/MM/YYYY') from users where role = 'tutor' order by id"
echo
echo "Pronto. Backup: $DUMP"
echo "Desfazer (código), só se nenhum aluno novo entrou depois do deploy:"
echo "  git checkout <hash anterior> && ${COMPOSE[*]} up -d --build"
echo "  Nunca volte para antes de 7a5531b com alunos sem e-mail no banco; restaure o backup junto."
echo "Restaurar banco:    ${COMPOSE[*]} exec -T db pg_restore -U aventuras -d aventuras --clean --if-exists < $DUMP"

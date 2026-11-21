#!/usr/bin/env bash
# Backup diário cifrado do Aventuras (roda pelo cron na VPS, sem perguntas).
# pg_dump → verificação (mesmas tabelas do deploy.sh) → cifra com age → apaga o texto claro → poda.
# A chave para decifrar fica só fora da VPS; aqui existe apenas a chave pública (recipient).
# Instalação: /usr/local/sbin/aventuras-backup + /etc/cron.d/aventuras-backup (ver docs/DEPLOY.md).
set -euo pipefail

REPO="${REPO:-/root/aventuras-educode-maraba}"
OUT="${OUT:-/root/backups/aventuras/cifrado}"
RECIPIENT_FILE="${RECIPIENT_FILE:-/root/.config/aventuras-backup/recipient.txt}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$REPO"
umask 077
mkdir -p "$OUT"
[ -s "$RECIPIENT_FILE" ] || { echo "Falta a chave pública em $RECIPIENT_FILE"; exit 1; }

STAMP="$(date -u +%Y%m%d-%H%M%S)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

docker compose exec -T db pg_dump -U aventuras -d aventuras -Fc > "$TMP/db.dump"

[ -s "$TMP/db.dump" ] || { echo "Dump vazio."; exit 1; }
toc="$(docker compose exec -T db pg_restore -l < "$TMP/db.dump")" || { echo "pg_restore não leu o dump."; exit 1; }
for t in users characters game_sessions session_players answers xp_ledger; do
  grep -q "TABLE DATA public $t " <<<"$toc" || { echo "Tabela ausente no dump: $t"; exit 1; }
done

# .part + mv: o Mac nunca puxa um arquivo pela metade.
age -R "$RECIPIENT_FILE" -o "$OUT/aventuras-$STAMP.dump.age.part" "$TMP/db.dump"
mv "$OUT/aventuras-$STAMP.dump.age.part" "$OUT/aventuras-$STAMP.dump.age"
age -R "$RECIPIENT_FILE" -o "$OUT/env-$STAMP.age.part" .env
mv "$OUT/env-$STAMP.age.part" "$OUT/env-$STAMP.age"

find "$OUT" -maxdepth 1 \( -name 'aventuras-*.dump.age' -o -name 'env-*.age' -o -name '*.part' \) -mtime +"$KEEP_DAYS" -delete

users="$(docker compose exec -T db psql -U aventuras -d aventuras -At -c 'select count(*) from users')"
echo "$(date -u +%FT%TZ) ok aventuras-$STAMP.dump.age ($(stat -c %s "$OUT/aventuras-$STAMP.dump.age") bytes, $users usuários)"

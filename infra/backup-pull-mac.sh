#!/bin/bash
# Mac: puxa os backups cifrados da VPS, confere o mais recente e poda os antigos.
# Roda pelo launchd (~/Library/LaunchAgents/br.educodemaraba.aventuras-backup.plist), todo dia às 09h;
# se o Mac estava dormindo, roda ao acordar. Falha → notificação do macOS + linha no log.
set -euo pipefail

VPS="${VPS:?defina VPS (ex.: root@IP-DA-VPS) no LaunchAgent}"
DEST="${DEST:-$HOME/Backups/aventuras}"
KEY="${KEY:-$HOME/.config/aventuras-backup/age-key.txt}"
KEEP_DAYS="${KEEP_DAYS:-30}"
MAX_IDADE_H="${MAX_IDADE_H:-50}"   # cron da VPS roda a cada 24 h; acima disso, algo parou

falhar() {
  echo "$(date '+%F %T') ERRO $*"
  osascript -e "display notification \"$*\" with title \"Backup do Aventuras falhou\"" >/dev/null 2>&1 || true
  exit 1
}

# Recebe a pasta de destino. Deve apagar os arquivos cifrados antigos
# (aventuras-*.dump.age e env-*.age) conforme KEEP_DAYS, sem nunca deixar a pasta sem backup.
podar_antigos() {
  local dir="$1"
  # TODO(human)
  :
}

umask 077
mkdir -p "$DEST"

/usr/bin/rsync -a --exclude '*.part' -e "ssh -o BatchMode=yes -o ConnectTimeout=20" \
  "$VPS:/root/backups/aventuras/cifrado/" "$DEST/" || falhar "rsync não conseguiu baixar da VPS"

latest="$(ls -t "$DEST"/aventuras-*.dump.age 2>/dev/null | head -1)"
[ -n "$latest" ] || falhar "nenhum dump em $DEST"

# Decifra só o começo: um dump do pg_dump -Fc começa com "PGDMP".
magic="$( (age -d -i "$KEY" "$latest" 2>/dev/null || true) | head -c 5)"
[ "$magic" = "PGDMP" ] || falhar "$(basename "$latest") não decifra como dump do Postgres"

idade_h=$(( ( $(date +%s) - $(stat -f %m "$latest") ) / 3600 ))
[ "$idade_h" -le "$MAX_IDADE_H" ] || falhar "último dump tem ${idade_h} h; o cron da VPS parou?"

podar_antigos "$DEST"

echo "$(date '+%F %T') ok $(basename "$latest") (${idade_h} h), $(ls "$DEST"/aventuras-*.dump.age | wc -l | tr -d ' ') dumps no Mac"

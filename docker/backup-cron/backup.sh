#!/bin/sh
# ─────────────────────────────────────────────────────────────
#  Sauvegardes PostgreSQL périodiques avec rotation.
#  Écrit des dumps compressés (format custom) dans $BACKUP_DIR.
# ─────────────────────────────────────────────────────────────
set -eu

: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:=cdf}"
: "${PGDATABASE:=cdfpos}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_INTERVAL:=900}"   # secondes entre deux dumps (défaut 15 min)
: "${BACKUP_KEEP:=96}"        # nombre de dumps à conserver (défaut 24 h à 15 min)

export PGPASSWORD

mkdir -p "$BACKUP_DIR"
echo "[backup-cron] démarrage — intervalle ${BACKUP_INTERVAL}s, rétention ${BACKUP_KEEP} dumps, cible ${PGHOST}/${PGDATABASE}"

while true; do
  TS=$(date +%Y%m%d-%H%M%S)
  FILE="$BACKUP_DIR/cdfpos-$TS.dump"
  if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -Fc -f "$FILE.tmp" 2>>"$BACKUP_DIR/backup.log"; then
    mv "$FILE.tmp" "$FILE"
    echo "[backup-cron] OK $FILE ($(du -h "$FILE" | cut -f1))"
  else
    echo "[backup-cron] ÉCHEC du dump à $TS (voir backup.log)" >&2
    rm -f "$FILE.tmp"
  fi

  # Rotation : ne garder que les BACKUP_KEEP dumps les plus récents.
  ls -1t "$BACKUP_DIR"/cdfpos-*.dump 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)) | while read -r old; do
    rm -f "$old"
  done

  sleep "$BACKUP_INTERVAL"
done

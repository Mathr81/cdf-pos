#!/bin/sh
# ─────────────────────────────────────────────────────────────
#  Sauvegardes périodiques avec rotation.
#    1. dumps PostgreSQL (format custom compressé)
#    2. archive des images produit
#
#  Les images vivent sur disque, hors base : pg_dump ne les couvre pas.
#  Sans le second étage, restaurer un dump rendrait des produits dont
#  l'image serait définitivement perdue.
# ─────────────────────────────────────────────────────────────
set -eu

: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGUSER:=cdf}"
: "${PGDATABASE:=cdfpos}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_INTERVAL:=900}"   # secondes entre deux dumps (défaut 15 min)
: "${BACKUP_KEEP:=96}"        # nombre de dumps à conserver (défaut 24 h à 15 min)
: "${MEDIA_DIR:=/media}"      # volume des images produit (monté en lecture seule)
: "${MEDIA_KEEP:=12}"         # nombre d'archives d'images à conserver
: "${MEDIA_SIG_FILE:=$BACKUP_DIR/.media-sig}"

export PGPASSWORD

mkdir -p "$BACKUP_DIR"
echo "[backup-cron] démarrage - intervalle ${BACKUP_INTERVAL}s, rétention ${BACKUP_KEEP} dumps, cible ${PGHOST}/${PGDATABASE}"
echo "[backup-cron] images : ${MEDIA_DIR}, rétention ${MEDIA_KEEP} archives"

# Sauvegarde des images, seulement si leur contenu a changé.
#
# Les noms de fichiers ÉTANT des hashes de contenu, la liste triée des noms
# suffit à signer l'état du dossier : si elle est identique, le contenu l'est.
# Sans ce test on écrirait 96 archives identiques par jour pour des photos qui
# ne changent qu'une fois par saison.
backup_media() {
  ts="$1"
  [ -d "$MEDIA_DIR" ] || return 0
  sig=$(ls -1 "$MEDIA_DIR" 2>/dev/null | sort | sha256sum | cut -d' ' -f1)
  prev=$(cat "$MEDIA_SIG_FILE" 2>/dev/null || echo "")
  if [ "$sig" = "$prev" ]; then
    return 0
  fi
  archive="$BACKUP_DIR/media-$ts.tar.gz"
  if tar -czf "$archive.tmp" -C "$MEDIA_DIR" . 2>>"$BACKUP_DIR/backup.log"; then
    mv "$archive.tmp" "$archive"
    printf '%s' "$sig" > "$MEDIA_SIG_FILE"
    echo "[backup-cron] images OK $archive ($(du -h "$archive" | cut -f1))"
  else
    echo "[backup-cron] ÉCHEC de l'archive images à $ts (voir backup.log)" >&2
    rm -f "$archive.tmp"
    return 0
  fi
  # Rotation propre aux images, indépendante de celle des dumps.
  ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +$((MEDIA_KEEP + 1)) | while read -r old; do
    rm -f "$old"
  done
}

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

  backup_media "$TS"

  sleep "$BACKUP_INTERVAL"
done

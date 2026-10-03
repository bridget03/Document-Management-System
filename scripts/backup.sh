#!/bin/sh
# Backup hàng ngày cho stack docker compose:
#   1. Postgres  -> db.sql  (pg_dump, gồm DROP IF EXISTS nên restore đè được)
#   2. File upload (volume document-storage) -> storage.tgz
# Kết quả: backups/<YYYYmmdd-HHMMSS>/{db.sql,storage.tgz}
#
# Dùng:  ./scripts/backup.sh
# Cron:  0 2 * * * cd /opt/DocManageSystem && ./scripts/backup.sh >> /var/log/dms-backup.log 2>&1
# Tùy biến: BACKUP_DIR=... KEEP_DAYS=... ./scripts/backup.sh
set -eu

ROOT=$(CDPATH= && cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

BACKUP_ROOT="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TS=$(date +%Y%m%d-%H%M%S)
DEST="$BACKUP_ROOT/$TS"
mkdir -p "$DEST"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
PUSER="${POSTGRES_USER:-dms_user}"
PDB="${POSTGRES_DB:-dms}"

echo "[backup] dumping postgres ($PDB) -> $DEST/db.sql"
docker compose exec -T postgres \
  pg_dump -U "$PUSER" -d "$PDB" --no-owner --no-acl --clean --if-exists \
  > "$DEST/db.sql"
test -s "$DEST/db.sql" || { echo "[backup] ERROR: db.sql rong"; exit 1; }

echo "[backup] archiving storage volume -> $DEST/storage.tgz"
STOR_VOL=$(docker volume ls -q --filter "name=document-storage" | head -n 1)
if [ -z "$STOR_VOL" ]; then
  echo "[backup] ERROR: khong tim thay volume document-storage (compose da up chua?)"
  exit 1
fi
docker run --rm \
  -v "$STOR_VOL:/data:ro" \
  -v "$DEST:/backup" \
  alpine tar czf /backup/storage.tgz -C /data .
echo "[backup] verify archive:"
docker run --rm -v "$DEST:/backup" alpine tar tzf /backup/storage.tgz | head -n 5

echo "[backup] prune backups older than ${KEEP_DAYS}d in $BACKUP_ROOT"
find "$BACKUP_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +

echo "[backup] OK: $DEST"
ls -lh "$DEST"

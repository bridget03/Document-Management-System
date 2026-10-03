#!/bin/sh
# One-shot: chuyen du lieu tu Render (free) ve may chu cong ty (docker compose).
#
# Chuan bi (xem chi tiet docs/ops-backup-restore.md):
#   1. Copy External Database URL cua Render dashboard -> RENDER_DATABASE_URL
#      (Postgres free tren Render sap/tat external access khi het han - lam som).
#   2. May chu cong ty: clone repo, tao .env (copy DRIVE_TOKEN_KEY + GOOGLE_*
#      tu Render sang; JWT_SECRET co the dat moi; sua CORS_ORIGINS).
#   3. Chay: RENDER_DATABASE_URL='postgres://...' ./scripts/migrate-from-render.sh
#
# Script lam:
#   A. pg_dump DB Render (qua docker image postgres:18, khong can cai postgres
#      tren host) -> backups/migrate-<time>/db.sql
#   B. Restore DB vao postgres local (tai su dung restore.sh --db-only)
#   C. Xuat CSV cac file can upload lai (file tren Render da mat do ephemerall
#      disk - chi con metadata) -> backups/migrate-<time>/can-upload-lai.csv
set -eu

ROOT=$(CDPATH= && cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

RENDER_DATABASE_URL="${RENDER_DATABASE_URL:?Thieu RENDER_DATABASE_URL (External Database URL tu Render dashboard)}"
# Render Postgres bat buoc SSL tu ben ngoai.
case "$RENDER_DATABASE_URL" in
  *sslmode=*) ;;
  *\?*) RENDER_DATABASE_URL="$RENDER_DATABASE_URL&sslmode=require" ;;
  *) RENDER_DATABASE_URL="$RENDER_DATABASE_URL?sslmode=require" ;;
esac

TS=$(date +%Y%m%d-%H%M%S)
DEST="${BACKUP_DIR:-$ROOT/backups}/migrate-$TS"
mkdir -p "$DEST"

echo "[migrate] A. dump DB tu Render -> $DEST/db.sql"
docker run --rm postgres:18 \
  pg_dump "$RENDER_DATABASE_URL" --no-owner --no-acl --clean --if-exists \
  > "$DEST/db.sql"
test -s "$DEST/db.sql" || { echo "[migrate] ERROR: db.sql rong (sai URL / DB Render het han?)"; exit 1; }
echo "[migrate] dump xong: $(wc -c < "$DEST/db.sql") bytes"

echo "[migrate] B. restore DB vao postgres local"
RESTORE_YES=1 "$ROOT/scripts/restore.sh" "$DEST" --db-only

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
PUSER="${POSTGRES_USER:-dms_user}"
PDB="${POSTGRES_DB:-dms}"

echo "[migrate] C. xuat danh sach file can upload lai (file goc tren Render da mat)"
docker compose exec -T postgres \
  psql -U "$PUSER" -d "$PDB" -c \
  "COPY (SELECT id, name, original_name, file_size, source, google_drive_file_id, created_at FROM documents WHERE local_file_path IS NOT NULL ORDER BY created_at) TO STDOUT WITH CSV HEADER" \
  > "$DEST/can-upload-lai.csv" || echo "[migrate] WARN: khong xuat duoc CSV (bang documents chua co? bo qua)"
if [ -f "$DEST/can-upload-lai.csv" ]; then
  echo "[migrate] so file can upload lai: $(($(wc -l < "$DEST/can-upload-lai.csv") - 1))"
fi

cat <<EOF
[migrate] XONG.
  - Dump:   $DEST/db.sql
  - CSV:    $DEST/can-upload-lai.csv
Viec con lai:
  1. Kiem tra web local: login, mo dashboard, mo 1 cong van.
  2. Upload lai cac file trong CSV (ban ghi nao co google_drive_file_id thi
     chay Drive sync de keo file ve thay vi upload tay).
  3. Bat backup dinh ky: cron chay scripts/backup.sh (xem docs/ops-backup-restore.md).
  4. Doi DNS/domain noi bo sang may chu moi, tat service tren Render.
EOF

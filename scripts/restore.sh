#!/bin/sh
# Restore stack docker compose từ 1 thư mục backup (do backup.sh tạo ra).
#
# Dùng:
#   ./scripts/restore.sh backups/20261003-020000            # restore cả DB + storage
#   ./scripts/restore.sh backups/20261003-020000 --db-only
#   ./scripts/restore.sh backups/20261003-020000 --storage-only
#   RESTORE_YES=1 ./scripts/restore.sh ...                   # bỏ qua hỏi xác nhận
#
# Lưu ý: restore DB sẽ XÓA dữ liệu hiện tại. Backend được stop trước khi
# restore rồi start lại (start.sh tự chạy `alembic upgrade head`).
set -eu

ROOT=$(CDPATH= && cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

SRC="${1:?Usage: restore.sh <backup-dir> [--db-only|--storage-only]}"
MODE="${2:-all}"
case "$MODE" in
  all | --db-only | --storage-only) ;;
  *)
    echo "Usage: restore.sh <backup-dir> [--db-only|--storage-only]"
    exit 1
    ;;
esac
[ -d "$SRC" ] || { echo "ERROR: khong tim thay thu muc $SRC"; exit 1; }

if [ "${RESTORE_YES:-0}" != "1" ]; then
  echo "Sap restore '$SRC' (mode: $MODE) - DU LIEU HIEN TAI SE BI GHI DE."
  printf "Go 'YES' de tiep tuc: "
  read -r ans
  [ "$ans" = "YES" ] || { echo "Huy."; exit 1; }
fi

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
fi
PUSER="${POSTGRES_USER:-dms_user}"
PDB="${POSTGRES_DB:-dms}"

echo "[restore] ensure postgres is up"
docker compose up -d postgres
echo "[restore] stop backend (tranh ghi du lieu khi restore)"
docker compose stop backend >/dev/null 2>&1 || true

case "$MODE" in
  all | --db-only)
    [ -f "$SRC/db.sql" ] || { echo "ERROR: thieu $SRC/db.sql"; exit 1; }
    echo "[restore] restoring postgres..."
    docker compose exec -T postgres \
      psql -U "$PUSER" -d "$PDB" -v ON_ERROR_STOP=1 \
      < "$SRC/db.sql"
    ;;
esac

case "$MODE" in
  all | --storage-only)
    [ -f "$SRC/storage.tgz" ] || { echo "ERROR: thieu $SRC/storage.tgz"; exit 1; }
    echo "[restore] restoring storage volume..."
    STOR_VOL=$(docker volume ls -q --filter "name=document-storage" | head -n 1)
    if [ -z "$STOR_VOL" ]; then
      echo "ERROR: khong tim thay volume document-storage"
      exit 1
    fi
    ABS_SRC=$(CDPATH= && cd -- "$SRC" && pwd)
    docker run --rm \
      -v "$STOR_VOL:/data" \
      -v "$ABS_SRC:/backup:ro" \
      alpine tar xzf /backup/storage.tgz -C /data
    ;;
esac

echo "[restore] start stack (backend tu chay migration)"
docker compose up -d
docker compose ps
echo "[restore] OK. Kiem tra: login web + mo thu 1 file preview/download."

# Vận hành: Backup / Restore / Chuyển từ Render về server công ty

> Tại sao cần tài liệu này: file đính kèm lưu trên ổ đĩa server (`STORAGE_PATH`,
> volume `document-storage`). Gói free của Render dùng ổ đĩa tạm (ephemeral) —
> service sleep/restart là **mất file**, chỉ còn metadata trong DB. Về server
> công ty + backup định kỳ thì hết triệt để.

## 1. Cái gì cần backup?

| Thành phần                        | Nằm ở đâu                  | Mất thì sao            |
| --------------------------------- | -------------------------- | ---------------------- |
| Postgres (`pgdata`)               | volume `pgdata`            | mất toàn bộ dữ liệu    |
| File upload (`document-storage`)  | volume `document-storage`  | preview/download 404   |
| File `.env` (secret, token Drive) | **không** trong backup     | lưu riêng (xem §4)     |

`scripts/backup.sh` backup 2 dòng đầu vào `backups/<ngày-giờ>/{db.sql,storage.tgz}`,
mặc định giữ **14 ngày** (`KEEP_DAYS=...` để đổi).

## 2. Backup tự động hàng ngày (server công ty)

```bash
cp .env.example .env   # điền POSTGRES_PASSWORD + JWT_SECRET, file này không commit
docker compose up -d --build

# backup tay lần đầu
./scripts/backup.sh

# cron chạy 2h sáng mỗi ngày
crontab -e
# thêm dòng:
0 2 * * * cd /opt/DocManageSystem && ./scripts/backup.sh >> /var/log/dms-backup.log 2>&1
```

Kiểm tra sau 1–2 ngày: `ls -lh backups/` phải có thư mục mới mỗi ngày, dung
lượng `db.sql`/`storage.tgz` > 0. Thỉnh thoảng mở 1 bản `storage.tgz` kiểm tra
(`tar tzf ...`).

## 3. Restore

```bash
./scripts/restore.sh backups/20261003-020000              # cả DB + file
./scripts/restore.sh backups/20261003-020000 --db-only     # chỉ DB
./scripts/restore.sh backups/20261003-020000 --storage-only
```

Script tự: dựng postgres → stop backend (tránh ghi dữ liệu giữa chừng) →
restore → `up` lại (backend tự chạy `alembic upgrade head`). Xong thì login web
và mở thử 1 file preview/download.

> **Nên diễn tập restore 1 lần/quý** sang máy test để chắc backup dùng được.

## 4. Chuyển dữ liệu từ Render về server công ty

**Bước 1 — Chuẩn bị trên máy chủ mới:**

```bash
git clone <repo> /opt/DocManageSystem && cd /opt/DocManageSystem
cp .env.example .env
```

Sửa `.env`, quan trọng nhất:

- `DRIVE_TOKEN_KEY`, `GOOGLE_CLIENT_ID/SECRET` — **copy y nguyên từ Render**,
  nếu đổi key mới thì token Drive đã mã hóa cũ không giải được, phải kết nối
  Drive lại từ đầu.
- `JWT_SECRET` — đặt mới cũng được (user chỉ phải login lại).
- `CORS_ORIGINS` — sửa thành domain/IP nội bộ (vd `http://192.168.1.10:5173`).
- `POSTGRES_PASSWORD` — đặt mật khẩu mạnh mới.

**Bước 2 — Lấy External Database URL** trong Render dashboard (service
`dms-db`). Lưu ý DB free của Render có thời hạn — làm sớm, để lâu URL chết là
không lấy được dữ liệu nữa.

**Bước 3 — Chạy migrate (1 lệnh):**

```bash
RENDER_DATABASE_URL='postgres://...' ./scripts/migrate-from-render.sh
```

Script sẽ: dump DB Render → restore vào Postgres local → backend tự migrate
lên schema mới nhất → xuất `can-upload-lai.csv`.

**Bước 4 — Upload lại file:** file gốc trên Render đã mất (ổ đĩa tạm), chỉ còn
metadata. Dựa vào `can-upload-lai.csv` để upload lại. Bản ghi nào có
`google_drive_file_id` thì vào trang Google Drive bấm **Sync** để kéo file về
thay vì upload tay.

**Bước 5 — Hoàn tất:** kiểm tra web (login, dashboard, mở công văn, preview),
bật cron backup (§2), trỏ DNS/domain nội bộ sang máy mới, tắt service Render.

## 5. Sự cố thường gặp

- `pg_dump`/restore báo lỗi version: script đã dùng image `postgres:18` trùng
  major với compose nên hiếm gặp; nếu Render đổi major mới hơn, sửa tag image
  trong script cho khớp.
- `sslmode`: script tự thêm `sslmode=require` khi dump từ Render.
- Hết dung lượng ổ đĩa: file upload tăng dần — đặt cảnh báo disk > 80% và
  dọn `backups/` cũ (script đã tự xóa quá `KEEP_DAYS`).
- Mất `.env`: backup không chứa secret — lưu `.env` trong password manager
  của công ty ngay từ ngày đầu.

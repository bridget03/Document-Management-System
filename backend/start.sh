#!/bin/sh
# Start script dùng chung cho Render và docker-compose:
# chạy migration trước rồi mới start app (DB trống cũng tự lên schema head).
# Render cấp PORT động; local mặc định 8000.
set -e
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"

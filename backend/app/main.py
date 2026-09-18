from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import logging

from app.core.config import settings
from app.database.database import SessionLocal, engine, Base
from app.models import User  # noqa: F401  (register models)
from app.models import Category, Tag, Document, GoogleDriveConfig, SyncLog, AuditLog, GoogleDriveSyncFile  # noqa
from app.models import DocumentType, CorrespondenceNumberConfig, CorrespondenceDocument  # noqa
from app.models import CorrespondenceAttachment, CorrespondenceLink  # noqa
from app.api.auth import router as auth_router
from app.api.documents import router as docs_router
from app.api.categories import router as cats_router
from app.api.tags import router as tags_router
from app.api.google_drive import router as drive_router
from app.api.correspondence import router as corr_router
from app.api.dashboard import router as dashboard_router
from app.core.security import hash_password

logger = logging.getLogger(__name__)
scheduler: BackgroundScheduler | None = None


def create_app() -> FastAPI:
    app = FastAPI(title="Document Management System", version="1.0.0", docs_url="/api/docs", redoc_url="/api/redoc")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list + ["*"] if settings.APP_ENV == "development" else settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception):
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            detail = exc.detail
            if isinstance(detail, dict):
                return JSONResponse(status_code=exc.status_code, content={"success": False, "error": detail})
            return JSONResponse(status_code=exc.status_code, content={"success": False, "error": {"code": "HTTP_ERROR", "message": str(detail)}})
        logger.exception("Unhandled error")
        if settings.APP_ENV == "production":
            return JSONResponse(status_code=500, content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}})
        return JSONResponse(status_code=500, content={"success": False, "error": {"code": "INTERNAL_ERROR", "message": str(exc)}})

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "1.0.0"}

    app.include_router(auth_router, prefix="/api")
    app.include_router(docs_router, prefix="/api")
    app.include_router(cats_router, prefix="/api")
    app.include_router(tags_router, prefix="/api")
    app.include_router(drive_router, prefix="/api")
    app.include_router(corr_router, prefix="/api")
    app.include_router(dashboard_router, prefix="/api")
    return app


app = create_app()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    seed()
    start_scheduler()


def seed():
    from app.models.correspondence import DocumentType

    db = SessionLocal()
    try:
        if not db.query(User).filter(User.email == "admin@example.com").first():
            db.add(User(name="Admin", email="admin@example.com", password_hash=hash_password("admin123"), role="ADMIN"))
        for name in ["Hợp đồng", "Báo cáo", "Kỹ thuật", "Tài chính", "Nhân sự", "Quy trình", "Khác"]:
            if not db.query(Category).filter(Category.name == name).first():
                db.add(Category(name=name))
        for code, name in [
            ("PD", "Phúc đáp"),
            ("DD", "Đôn đốc / chấn chỉnh / nhắc nhở"),
            ("GT", "Giải thích"),
            ("TB", "Thông báo"),
            ("GTR", "Giải trình"),
            ("DN", "Đề nghị"),
        ]:
            if not db.query(DocumentType).filter(DocumentType.code == code).first():
                db.add(DocumentType(code=code, name=name, status="ACTIVE"))
        db.commit()
    finally:
        db.close()


def scheduled_job():
    from app.models.google_drive import GoogleDriveConfig
    from app.services.sync_service import get_sync_batch, run_sync, is_sync_running

    db = SessionLocal()
    try:
        cfg = db.query(GoogleDriveConfig).filter(GoogleDriveConfig.is_active == True).first()  # noqa: E712
        if not cfg or not cfg.access_token:
            return
        if is_sync_running():
            return
        try:
            drive_files, scope_ids = get_sync_batch(db, cfg)
            run_sync(db, cfg, drive_files, scope_file_ids=scope_ids)
        except Exception as e:
            logger.exception(f"Scheduled sync failed: {e}")
    finally:
        db.close()


def start_scheduler():
    global scheduler
    if settings.APP_ENV == "test":
        return
    interval = settings.SYNC_INTERVAL_MINUTES
    if interval <= 0:
        return
    scheduler = BackgroundScheduler()
    scheduler.add_job(scheduled_job, "interval", minutes=interval, id="drive-sync")
    scheduler.start()

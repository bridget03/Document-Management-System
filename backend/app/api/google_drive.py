from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db
from app.models.google_drive import GoogleDriveConfig
from app.models.sync_file import GoogleDriveSyncFile
from app.models.sync_log import SyncLog
from app.models.user import User
from app.schemas.google_drive import (
    DriveConfigRequest,
    DriveStatus,
    SyncFileOut,
    SyncFilesRequest,
    SyncLogOut,
)
from app.services.audit_service import log as audit_log
from app.services.token_crypto import protect_token, reveal_token
from app.services.google_drive_service import browse_items, build_drive_service, get_oauth_flow
from app.services.sync_service import get_sync_batch, is_sync_running, run_sync, sync_scope_of

router = APIRouter(prefix="/google-drive", tags=["google-drive"])


def _active_config(db: Session) -> GoogleDriveConfig | None:
    return db.query(GoogleDriveConfig).filter(GoogleDriveConfig.is_active == True).first()  # noqa: E712


def _require_drive_service(cfg: GoogleDriveConfig):
    if not cfg or not cfg.access_token:
        raise HTTPException(status_code=400, detail="Google Drive not connected")
    return build_drive_service(reveal_token(cfg.access_token) or "", reveal_token(cfg.refresh_token) or "")


@router.get("/auth")
def drive_auth(admin: User = Depends(require_admin)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    flow = get_oauth_flow()
    url, _ = flow.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="true")
    return {"auth_url": url}


@router.get("/callback")
def drive_callback(code: str, db: Session = Depends(get_db)):
    flow = get_oauth_flow()
    flow.fetch_token(code=code)
    creds = flow.credentials
    cfg = _active_config(db) or GoogleDriveConfig()
    cfg.access_token = protect_token(creds.token)
    cfg.refresh_token = protect_token(creds.refresh_token) or cfg.refresh_token
    if creds.expiry:
        cfg.token_expires_at = creds.expiry.replace(tzinfo=None)
    cfg.is_active = True
    db.add(cfg)
    db.commit()
    return {"success": True, "message": "Google Drive connected"}


@router.get("/status", response_model=DriveStatus)
def drive_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = _active_config(db)
    if not cfg or not cfg.refresh_token:
        return {"connected": False}
    last = db.query(SyncLog).order_by(SyncLog.started_at.desc()).first()
    selected = db.query(GoogleDriveSyncFile).filter(GoogleDriveSyncFile.config_id == cfg.id).count()
    return {
        "connected": True,
        "email": cfg.connected_email,
        "folder_id": cfg.folder_id,
        "folder_name": cfg.folder_name,
        "sync_scope": sync_scope_of(cfg),
        "selected_count": selected,
        "last_sync": last.completed_at if last else None,
    }


@router.get("/folders")
def drive_folders(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cfg = _active_config(db)
    service = _require_drive_service(cfg)
    return {"folders": browse_items(service).get("folders", [])}


@router.get("/items")
def drive_items(
    parent_id: str | None = Query(None, description="Drive folder id; omit for My Drive root"),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Browse one Drive level: {folders, files} with metadata. No recursion (V1)."""
    cfg = _active_config(db)
    service = _require_drive_service(cfg)
    try:
        return browse_items(service, parent_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Drive API error: {e}")


@router.get("/sync-files", response_model=list[SyncFileOut])
def list_sync_files(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    cfg = _active_config(db)
    if not cfg:
        return []
    return (
        db.query(GoogleDriveSyncFile)
        .filter(GoogleDriveSyncFile.config_id == cfg.id)
        .order_by(GoogleDriveSyncFile.file_name)
        .all()
    )


@router.post("/sync-files", response_model=list[SyncFileOut])
def save_sync_files(payload: SyncFilesRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Replace the FILES selection (empty list clears it)."""
    cfg = _active_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Google Drive not connected")
    seen: set[str] = set()
    rows: list[GoogleDriveSyncFile] = []
    for f in payload.files:
        fid = (f.file_id or "").strip()
        if not fid or fid in seen:
            continue
        seen.add(fid)
        rows.append(
            GoogleDriveSyncFile(
                config_id=cfg.id,
                google_drive_file_id=fid,
                file_name=f.file_name,
                mime_type=f.mime_type,
                google_drive_parent_id=f.parent_id,
            )
        )
    db.query(GoogleDriveSyncFile).filter(GoogleDriveSyncFile.config_id == cfg.id).delete()
    db.add_all(rows)
    db.commit()
    return (
        db.query(GoogleDriveSyncFile)
        .filter(GoogleDriveSyncFile.config_id == cfg.id)
        .order_by(GoogleDriveSyncFile.file_name)
        .all()
    )


@router.delete("/sync-files/{drive_file_id}")
def remove_sync_file(drive_file_id: str, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cfg = _active_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Google Drive not connected")
    db.query(GoogleDriveSyncFile).filter(
        GoogleDriveSyncFile.config_id == cfg.id,
        GoogleDriveSyncFile.google_drive_file_id == drive_file_id,
    ).delete()
    db.commit()
    return {"success": True}


@router.post("/config", response_model=DriveStatus)
def save_config(payload: DriveConfigRequest, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cfg = _active_config(db) or GoogleDriveConfig(is_active=True)
    if payload.folder_id is not None:
        cfg.folder_id = payload.folder_id
    if payload.folder_name is not None:
        cfg.folder_name = payload.folder_name
    if payload.drive_id is not None:
        cfg.drive_id = payload.drive_id
    if payload.sync_scope is not None:
        scope = payload.sync_scope.upper()
        if scope not in ("FOLDER", "FILES"):
            raise HTTPException(status_code=400, detail="sync_scope must be FOLDER or FILES")
        cfg.sync_scope = scope
    db.add(cfg)
    db.flush()
    scope = sync_scope_of(cfg)
    if scope == "FOLDER" and not cfg.folder_id:
        raise HTTPException(status_code=400, detail="Please select a folder.")
    if scope == "FILES":
        count = db.query(GoogleDriveSyncFile).filter(GoogleDriveSyncFile.config_id == cfg.id).count()
        if count == 0:
            raise HTTPException(status_code=400, detail="Please select at least one file.")
    audit_log(db, admin.id, "DRIVE_CONFIG", request=request)
    db.commit()
    selected = db.query(GoogleDriveSyncFile).filter(GoogleDriveSyncFile.config_id == cfg.id).count()
    return {
        "connected": bool(cfg.refresh_token),
        "folder_id": cfg.folder_id,
        "folder_name": cfg.folder_name,
        "sync_scope": scope,
        "selected_count": selected,
    }


@router.post("/sync")
def trigger_sync(request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cfg = _active_config(db)
    if not cfg:
        raise HTTPException(status_code=400, detail="Google Drive not connected")
    if is_sync_running():
        raise HTTPException(status_code=429, detail="Sync already running")
    try:
        drive_files, scope_ids = get_sync_batch(db, cfg)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log = SyncLog(config_id=cfg.id, started_at=datetime.utcnow(), completed_at=datetime.utcnow(), status="FAILED", error_message=str(e))
        db.add(log)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Drive API error: {e}")
    log = run_sync(db, cfg, drive_files, scope_file_ids=scope_ids)
    audit_log(db, admin.id, "DRIVE_SYNC", request=request)
    db.commit()
    return {"success": True, "log_id": log.id, "total": log.total_files, "created": log.created_files, "updated": log.updated_files, "failed": log.failed_files}


@router.get("/sync-logs", response_model=list[SyncLogOut])
def sync_logs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(SyncLog).order_by(SyncLog.started_at.desc()).limit(50).all()

"""One-way sync: Google Drive -> DMS. Never deletes Drive files, never uploads to Drive in V1."""
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.google_drive import GoogleDriveConfig
from app.models.sync_file import GoogleDriveSyncFile
from app.models.sync_log import SyncLog
from app.services.document_service import sanitize_filename

_sync_running = False


def is_sync_running() -> bool:
    return _sync_running


def sync_scope_of(config: GoogleDriveConfig) -> str:
    """FOLDER for legacy configs (column defaults to FOLDER)."""
    return (config.sync_scope or "FOLDER").upper()


def get_sync_batch(db: Session, config: GoogleDriveConfig) -> tuple[list[dict], set[str] | None]:
    """Collect the Drive file batch for this config.

    FOLDER -> every file in the configured folder (scope None).
    FILES  -> metadata of selected files only (scope = selected ids).
    Raises ValueError for configuration problems, RuntimeError for Drive errors.
    Missing selected files are skipped here; run_sync marks them REMOTE_MISSING.
    """
    from app.services.google_drive_service import (
        DriveFileNotFound,
        build_drive_service,
        get_file_metadata,
        list_files_in_folder,
    )

    from app.services.token_crypto import reveal_token

    if not config.access_token:
        raise ValueError("Google Drive not connected")
    service = build_drive_service(reveal_token(config.access_token) or "", reveal_token(config.refresh_token) or "")
    if sync_scope_of(config) == "FILES":
        selected = db.query(GoogleDriveSyncFile).filter(GoogleDriveSyncFile.config_id == config.id).all()
        if not selected:
            raise ValueError("No files selected for sync")
        batch: list[dict] = []
        for s in selected:
            try:
                batch.append(get_file_metadata(service, s.google_drive_file_id))
            except DriveFileNotFound:
                continue
        return batch, {s.google_drive_file_id for s in selected}
    if not config.folder_id:
        raise ValueError("Sync folder not configured")
    return list_files_in_folder(service, config.folder_id), None


def run_sync(db: Session, config: GoogleDriveConfig, drive_files: list[dict], scope_file_ids: set[str] | None = None) -> SyncLog:
    """drive_files: list of dicts from Drive API. Pure DB logic (testable without API).

    scope_file_ids restricts REMOTE_MISSING detection to the FILES selection;
    None (FOLDER mode) keeps the legacy behavior of checking all synced docs.
    """
    global _sync_running
    if _sync_running:
        raise RuntimeError("Sync already running")
    _sync_running = True
    log = SyncLog(config_id=config.id, started_at=datetime.utcnow(), status="RUNNING")
    db.add(log)
    db.commit()
    created = updated = failed = 0
    seen_ids: set[str] = set()
    try:
        for f in drive_files:
            fid = f.get("id")
            seen_ids.add(fid)
            try:
                existing = db.query(Document).filter(Document.google_drive_file_id == fid).first()
                modified_raw = f.get("modifiedTime")
                modified = None
                if modified_raw:
                    modified = datetime.fromisoformat(modified_raw.replace("Z", "+00:00").split("+")[0])
                name = f.get("name", "untitled")
                ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
                if existing:
                    if modified and existing.google_drive_modified_at:
                        if modified <= existing.google_drive_modified_at.replace(tzinfo=None):
                            continue
                    existing.name = sanitize_filename(name)
                    existing.google_drive_modified_at = modified
                    existing.google_drive_url = f.get("webViewLink")
                    existing.last_synced_at = datetime.utcnow()
                    existing.sync_status = "SYNCED"
                    if f.get("parents"):
                        existing.google_drive_parent_id = f["parents"][0]
                    updated += 1
                else:
                    doc = Document(
                        name=sanitize_filename(name),
                        original_name=sanitize_filename(name),
                        mime_type=f.get("mimeType"),
                        file_extension=ext,
                        file_size=int(f.get("size", 0)) if f.get("size") else None,
                        storage_type="GOOGLE_DRIVE",
                        google_drive_file_id=fid,
                        google_drive_url=f.get("webViewLink"),
                        google_drive_parent_id=(f.get("parents") or [None])[0],
                        source="GOOGLE_DRIVE",
                        sync_status="SYNCED",
                        google_drive_modified_at=modified,
                        last_synced_at=datetime.utcnow(),
                    )
                    db.add(doc)
                    created += 1
            except Exception:
                failed += 1
        # Missing files: mark REMOTE_MISSING (do NOT delete record).
        # In FILES mode only consider docs belonging to the selection, so
        # unselected files are never touched.
        if seen_ids or scope_file_ids is not None:
            missing_q = (
                db.query(Document)
                .filter(Document.source == "GOOGLE_DRIVE", Document.sync_status == "SYNCED")
            )
            if scope_file_ids is not None:
                missing_q = missing_q.filter(Document.google_drive_file_id.in_(list(scope_file_ids)))
            for doc in missing_q.all():
                if doc.google_drive_file_id and doc.google_drive_file_id not in seen_ids:
                    doc.sync_status = "REMOTE_MISSING"
        total = len(drive_files)
        log.total_files = total
        log.created_files = created
        log.updated_files = updated
        log.failed_files = failed
        log.status = "SUCCESS" if failed == 0 else "PARTIAL"
        log.completed_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        log.status = "FAILED"
        log.error_message = str(e)
        log.completed_at = datetime.utcnow()
        db.commit()
    finally:
        _sync_running = False
    db.refresh(log)
    return log

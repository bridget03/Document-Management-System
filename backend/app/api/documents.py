from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database.database import get_db, normalize_text
from app.models.document import Document
from app.models.tag import Tag
from app.models.user import User
from app.schemas.document import DocumentOut, DocumentUpdate, PaginatedDocuments
from app.core.permissions import can_view_document, scope_document_query
from app.services.audit_service import log as audit_log
from app.services.document_service import sanitize_filename, validate_file
from app.services.file_service import LocalStorageProvider
from app.services.search_service import apply_filters

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_SORT = {"name", "file_size", "created_at", "updated_at"}


def storage() -> LocalStorageProvider:
    return LocalStorageProvider(settings.STORAGE_PATH)


def get_or_create_tags(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for n in names:
        n = normalize_text(n.strip()) or ""
        if not n:
            continue
        t = db.query(Tag).filter(Tag.name == n).first()
        if not t:
            t = Tag(name=n)
            db.add(t)
            db.flush()
        tags.append(t)
    return tags


def audit(db: Session, user: User, action: str, doc_id: str | None, request: Request | None = None):
    audit_log(db, user.id, action, document_id=doc_id, request=request)


@router.get("", response_model=PaginatedDocuments)
def list_documents(
    q: str | None = None,
    category_id: str | None = None,
    tag_id: str | None = None,
    mime_type: str | None = None,
    file_extension: str | None = None,
    uploaded_by: str | None = None,
    source: str | None = None,
    sync_status: str | None = None,
    created_from: datetime | None = None,
    created_to: datetime | None = None,
    updated_from: datetime | None = None,
    updated_to: datetime | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    scope: str = Query("all", description="all|mine|department"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if sort_by not in ALLOWED_SORT:
        sort_by = "created_at"
    col = getattr(Document, sort_by)
    col = col.desc() if sort_order == "desc" else col.asc()
    query = scope_document_query(db.query(Document), user)
    if scope == "mine":
        query = query.filter(Document.uploaded_by == user.id)
    elif scope == "department" and getattr(user, "department", None):
        query = query.filter(Document.department == user.department)
    query = apply_filters(
        query, q, category_id, tag_id, file_extension, mime_type, uploaded_by,
        source, sync_status, created_from, created_to, updated_from, updated_to,
    )
    total = query.count()
    items = query.order_by(col).offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return {"items": items, "page": page, "page_size": page_size, "total": total, "total_pages": total_pages}


@router.get("/search", response_model=PaginatedDocuments)
def search_documents(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list_documents(q=q, page=page, page_size=page_size, db=db, user=user)


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    name: str | None = Form(None),
    description: str | None = Form(None),
    category_id: str | None = Form(None),
    tags: str | None = Form(None),
    visibility: str | None = Form(None),
    department: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from app.core.permissions import normalize_visibility

    data = await file.read()
    try:
        ext, mime = validate_file(file.filename or "file", file.content_type, len(data), settings.max_file_size_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    vis = normalize_visibility(visibility)
    dept = normalize_text((department or "").strip()) or None
    if vis == "DEPARTMENT":
        dept = dept or getattr(user, "department", None)
        if not dept:
            raise HTTPException(status_code=400, detail="Chia sẻ theo phòng ban thì phải chọn phòng ban.")
    rel = storage().save(data, ext)
    tag_names = [t.strip() for t in (tags or "").split(",") if t.strip()]
    doc = Document(
        name=sanitize_filename(name or file.filename or "unnamed"),
        original_name=sanitize_filename(file.filename or "unnamed"),
        description=normalize_text(description),
        mime_type=mime,
        file_extension=ext,
        file_size=len(data),
        storage_type="LOCAL",
        local_file_path=rel,
        category_id=category_id or None,
        uploaded_by=user.id,
        visibility=vis,
        department=dept,
        source="LOCAL_UPLOAD",
        sync_status="NOT_SYNCED",
        tags=get_or_create_tags(db, tag_names),
    )
    db.add(doc)
    db.flush()  # materialize Python-side UUID before auditing
    audit(db, user, "UPLOAD", doc.id, request)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_view_document(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem tài liệu này.")
    return doc


@router.put("/{doc_id}", response_model=DocumentOut)
def update_document(doc_id: str, payload: DocumentUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.role != "ADMIN" and doc.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to edit this document")
    if payload.name is not None:
        doc.name = sanitize_filename(payload.name)
    if payload.description is not None:
        doc.description = normalize_text(payload.description)
    if payload.category_id is not None:
        doc.category_id = payload.category_id or None
    if payload.tags is not None:
        doc.tags = get_or_create_tags(db, payload.tags)
    if payload.visibility is not None:
        from app.core.permissions import normalize_visibility
        doc.visibility = normalize_visibility(payload.visibility)
    if payload.department is not None:
        doc.department = normalize_text(payload.department.strip()) or None
    if doc.visibility == "DEPARTMENT" and not doc.department:
        raise HTTPException(status_code=400, detail="Chia sẻ theo phòng ban thì phải chọn phòng ban.")
    audit(db, user, "UPDATE", doc.id, request)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
def delete_document(doc_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.role != "ADMIN" and doc.uploaded_by != user.id:
        raise HTTPException(status_code=403, detail="Not allowed to delete this document")
    # V1: never delete remote Google Drive file; only local copy + DB record
    if doc.local_file_path and doc.storage_type in ("LOCAL", "BOTH"):
        try:
            storage().delete(doc.local_file_path)
        except Exception:
            pass
    audit(db, user, "DELETE", doc.id, request)
    db.delete(doc)
    db.commit()
    return {"success": True}


@router.get("/{doc_id}/download")
def download_document(doc_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not can_view_document(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền tải tài liệu này.")
    audit(db, user, "DOWNLOAD", doc.id, request)
    db.commit()
    if doc.local_file_path and storage().exists(doc.local_file_path):
        path = storage().full_path(doc.local_file_path)
        return FileResponse(path, filename=doc.original_name, media_type=doc.mime_type or "application/octet-stream")
    if doc.google_drive_url:
        raise HTTPException(status_code=400, detail="File lives on Google Drive. Use 'Open in Google Drive'.")
    raise HTTPException(status_code=404, detail="File content not available")


@router.get("/{doc_id}/preview")
def preview_document(doc_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Read-only preview. Returns raw bytes with `Content-Disposition: inline`
    for viewable types so browsers/viewers render directly; a JSON
    `unavailable` payload otherwise. Same auth as download. Never exposes
    filesystem paths or Google tokens. Previews of HIGH-security documents
    are audit-logged."""
    from fastapi.responses import Response as FastAPIResponse

    from app.models.correspondence import CorrespondenceAttachment, CorrespondenceDocument
    from app.models.google_drive import GoogleDriveConfig
    from app.services.google_drive_service import NATIVE_EXPORT_MIMES, NATIVE_MIMES, get_drive_file_bytes

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    is_high = db.query(CorrespondenceAttachment.id).join(
        CorrespondenceDocument, CorrespondenceDocument.id == CorrespondenceAttachment.correspondence_id
    ).filter(
        CorrespondenceAttachment.document_id == doc.id,
        CorrespondenceDocument.security_level == "HIGH",
    ).first() is not None
    if not can_view_document(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem tài liệu này.")
    if is_high:
        audit(db, user, "PREVIEW", doc.id, request)
        db.commit()
    ext = (doc.file_extension or "").lower()
    native_mime = (doc.mime_type or "")

    if native_mime in NATIVE_MIMES and native_mime not in NATIVE_EXPORT_MIMES:
        raise HTTPException(
            status_code=400,
            detail="This Google file type cannot be previewed here. Use 'Open in Google Drive'.",
        )
    # Native Docs/Sheets/Slides/Drawings are exported to PDF for preview.
    is_exported_pdf = native_mime in NATIVE_EXPORT_MIMES
    if is_exported_pdf:
        ext = "pdf"

    # Types served as raw bytes for in-browser / client-side viewers.
    RAW_INLINE = {"pdf", "jpg", "jpeg", "png", "webp", "txt", "csv", "xls", "xlsx", "docx"}
    if ext not in RAW_INLINE:
        return {"preview": "unavailable", "message": "Preview is not available. [Download file]"}

    inline_name = "".join(c for c in (doc.original_name or "file") if c.isascii() and c not in '"\r\n') or "file"
    headers = {"Content-Disposition": f'inline; filename="{inline_name}"'}

    # 1) Local file (or local copy of a Drive file).
    if doc.local_file_path and storage().exists(doc.local_file_path):
        path = storage().full_path(doc.local_file_path)
        mt = doc.mime_type or "application/octet-stream"
        if ext == "txt":
            mt = "text/plain; charset=utf-8"
        elif ext == "csv":
            mt = "text/csv; charset=utf-8"
        return FileResponse(path, media_type=mt, headers=headers)

    # 2) Drive-only file: stream bytes through the backend (token stays server-side).
    if doc.google_drive_file_id:
        cfg = db.query(GoogleDriveConfig).filter(GoogleDriveConfig.is_active == True).first()  # noqa: E712
        if not cfg or not cfg.refresh_token:
            raise HTTPException(status_code=400, detail="Google Drive not connected")
        try:
            data, mime, _ = get_drive_file_bytes(db, cfg, doc.google_drive_file_id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except RuntimeError as e:
            raise HTTPException(status_code=404, detail=str(e))
        # Exported PDFs carry the export mime, not the native google-apps mime.
        mt = mime if is_exported_pdf else (doc.mime_type or mime)
        if ext == "txt":
            mt = "text/plain; charset=utf-8"
        return FastAPIResponse(content=data, media_type=mt, headers=headers)

    raise HTTPException(status_code=404, detail="Preview content not available")

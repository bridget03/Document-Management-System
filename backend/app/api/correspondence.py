from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.core.permissions import can_delete_corr, can_edit_corr, can_view_corr, dept_match_filter, scope_corr_query
from app.database.database import get_db
from app.models.correspondence import (
    CorrespondenceDocument,
    CorrespondenceLink,
    CorrespondenceFolder,
    CorrespondenceFolderItem,
    DocumentType,
)
from app.models.user import User
from app.schemas.correspondence import (
    CorrCreate,
    CorrOut,
    CorrUpdate,
    DocTypeIn,
    DocTypeOut,
    ImportResult,
    NumberConfigIn,
    NumberConfigOut,
    PaginatedCorr,
    FolderIn,
    FolderDocumentsIn,
)
from app.services import correspondence_service as svc

router = APIRouter(prefix="/correspondence", tags=["correspondence"])

DIRECTIONS = ("INCOMING", "OUTGOING", "INTERNAL")
# Public sort keys used by the correspondence list.  Keeping this map explicit
# prevents an arbitrary query parameter from becoming a SQL column reference.
SORTS = {
    "document_number": CorrespondenceDocument.document_number,
    "document_type": DocumentType.name,
    "party": None,  # Sender for incoming documents, recipient otherwise.
    "signer": CorrespondenceDocument.signer,
    "signed_date": CorrespondenceDocument.signed_date,
    "issue_date": CorrespondenceDocument.issue_date,
    "processing_status": CorrespondenceDocument.processing_status,
    "created_at": CorrespondenceDocument.created_at,
    "updated_at": CorrespondenceDocument.updated_at,
}


def _direction_or_400(direction: str) -> str:
    d = direction.upper()
    if d not in DIRECTIONS:
        raise HTTPException(status_code=404, detail="Unknown direction")
    return d


def _audit(db: Session, user: User, action: str, corr_id: str | None, request: Request | None = None):
    from app.services.audit_service import log as audit_log
    audit_log(db, user.id, action, correspondence_id=corr_id, request=request)


def _get_or_404(db: Session, direction: str, corr_id: str) -> CorrespondenceDocument:
    doc = db.query(CorrespondenceDocument).filter(
        CorrespondenceDocument.id == corr_id,
        CorrespondenceDocument.direction == direction,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Văn bản không tồn tại.")
    return doc


def _require_view(user: User, doc: CorrespondenceDocument) -> None:
    if not can_view_corr(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem văn bản này.")


def _require_edit(user: User, doc: CorrespondenceDocument) -> None:
    if not can_edit_corr(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa văn bản này.")


def _require_delete(user: User, doc: CorrespondenceDocument) -> None:
    if not can_delete_corr(user, doc):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa văn bản này.")


def _get_personal_folder(db: Session, user: User, direction: str, folder_id: str) -> CorrespondenceFolder:
    folder = db.query(CorrespondenceFolder).filter(
        CorrespondenceFolder.id == folder_id,
        CorrespondenceFolder.owner_id == user.id,
        CorrespondenceFolder.direction == direction,
    ).first()
    if not folder:
        raise HTTPException(status_code=400, detail="Thư mục không hợp lệ.")
    return folder


# ---------- List / search ----------

def _list(direction: str, db: Session, user: User, q=None, type_id=None, signer=None,
          department=None, security=None, urgency=None, status=None,
          date_from: date | None = None, date_to: date | None = None,
          sort_by="issue_date", sort_order="desc", scope="all", folder_id=None, page=1, page_size=20,
          is_important: bool | None = None):
    if sort_by not in SORTS:
        sort_by = "issue_date"
    if sort_order not in {"asc", "desc"}:
        sort_order = "desc"
    col = SORTS[sort_by]
    if sort_by == "party":
        col = CorrespondenceDocument.sender if direction == "INCOMING" else CorrespondenceDocument.recipient
    query = scope_corr_query(db.query(CorrespondenceDocument), user)
    if scope == "mine":
        query = query.filter(CorrespondenceDocument.created_by == user.id)
    elif scope == "department" and getattr(user, "department", None):
        query = query.filter(dept_match_filter(CorrespondenceDocument.department, user.department))
    if folder_id:
        folder = db.query(CorrespondenceFolder).filter(
            CorrespondenceFolder.id == folder_id,
            CorrespondenceFolder.owner_id == user.id,
            CorrespondenceFolder.direction == direction,
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Thư mục không tồn tại.")
        query = query.join(
            CorrespondenceFolderItem,
            CorrespondenceFolderItem.correspondence_id == CorrespondenceDocument.id,
        ).filter(
            CorrespondenceFolderItem.folder_id == folder.id,
            CorrespondenceFolderItem.owner_id == user.id,
        )
    # Needed only for the document-type label column. This relationship is
    # optional, hence the outer join; search reuses it when present.
    document_type_joined = sort_by == "document_type"
    if document_type_joined:
        query = query.outerjoin(DocumentType, CorrespondenceDocument.document_type_id == DocumentType.id)
    query = svc.apply_corr_filters(
        query, direction, q, type_id, signer,
        department, security, urgency, status, date_from, date_to, document_type_joined,
        is_important)
    total = query.count()
    order = col.desc() if sort_order == "desc" else col.asc()
    # A deterministic fallback prevents records with equal values moving
    # between pages as users navigate a sorted result.
    items = query.order_by(order, CorrespondenceDocument.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "page": page, "page_size": page_size,
            "total": total, "total_pages": (total + page_size - 1) // page_size if total else 0}


@router.get("/incoming", response_model=PaginatedCorr)
def list_incoming(q: str | None = None, type_id: str | None = None, signer: str | None = None,
                  department: str | None = None, security: str | None = None, urgency: str | None = None,
                  status: str | None = None, date_from: date | None = None, date_to: date | None = None,
                  sort_by: str = "issue_date", sort_order: str = "desc",
                  scope: str = Query("all", description="all|mine|department"),
                  folder_id: str | None = None,
                  is_important: bool | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _list("INCOMING", db, user, q, type_id, signer, department, security, urgency,
                 status, date_from, date_to, sort_by, sort_order, scope, folder_id, page, page_size,
                 is_important)


@router.get("/outgoing", response_model=PaginatedCorr)
def list_outgoing(q: str | None = None, type_id: str | None = None, signer: str | None = None,
                  department: str | None = None, security: str | None = None, urgency: str | None = None,
                  status: str | None = None, date_from: date | None = None, date_to: date | None = None,
                  sort_by: str = "issue_date", sort_order: str = "desc",
                  scope: str = Query("all", description="all|mine|department"),
                  folder_id: str | None = None,
                  is_important: bool | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _list("OUTGOING", db, user, q, type_id, signer, department, security, urgency,
                 status, date_from, date_to, sort_by, sort_order, scope, folder_id, page, page_size,
                 is_important)


@router.get("/internal", response_model=PaginatedCorr)
def list_internal(q: str | None = None, type_id: str | None = None, signer: str | None = None,
                  department: str | None = None, security: str | None = None, urgency: str | None = None,
                  status: str | None = None, date_from: date | None = None, date_to: date | None = None,
                  sort_by: str = "issue_date", sort_order: str = "desc",
                  scope: str = Query("all", description="all|mine|department"),
                  folder_id: str | None = None,
                  is_important: bool | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _list("INTERNAL", db, user, q, type_id, signer, department, security, urgency,
                 status, date_from, date_to, sort_by, sort_order, scope, folder_id, page, page_size,
                 is_important)


# ---------- Time tree stats (Year -> Direction -> Month) ----------

@router.get("/stats/tree")
def stats_tree(
    scope: str = Query("all", description="all|mine|department"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Count công văn theo (năm, direction, tháng) dựa trên issue_date.

    Dùng để dựng cây Công văn -> Năm -> Loại -> Tháng trong 1 request,
    thay vì gọi N lần list API. Tôn trọng phân quyền xem (visibility).
    Bản ghi issue_date IS NULL không lên cây.
    """
    year_expr = func.extract("year", CorrespondenceDocument.issue_date).label("year")
    month_expr = func.extract("month", CorrespondenceDocument.issue_date).label("month")
    query = db.query(
        year_expr,
        CorrespondenceDocument.direction,
        month_expr,
        func.count(CorrespondenceDocument.id).label("count"),
    )
    query = scope_corr_query(query, user)
    if scope == "mine":
        query = query.filter(CorrespondenceDocument.created_by == user.id)
    elif scope == "department" and getattr(user, "department", None):
        query = query.filter(dept_match_filter(CorrespondenceDocument.department, user.department))
    query = query.filter(CorrespondenceDocument.issue_date.is_not(None))
    query = query.group_by(year_expr, CorrespondenceDocument.direction, month_expr)
    query = query.order_by(year_expr.desc(), CorrespondenceDocument.direction.asc(), month_expr.asc())
    out = []
    for year, direction, month, count in query.all():
        try:
            y, m = int(year), int(month)
        except (TypeError, ValueError):
            continue
        out.append({"year": y, "direction": direction, "month": m, "count": count})
    return {"items": out}


# ---------- Personal folders ----------

@router.get("/folders")
def list_folders(direction: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(
        CorrespondenceFolder.id,
        CorrespondenceFolder.name,
        CorrespondenceFolder.direction,
        CorrespondenceFolder.parent_id,
        CorrespondenceFolder.created_at,
        func.count(CorrespondenceFolderItem.id).label("item_count"),
    ).outerjoin(
        CorrespondenceFolderItem,
        CorrespondenceFolderItem.folder_id == CorrespondenceFolder.id,
    ).filter(
        CorrespondenceFolder.owner_id == user.id,
        CorrespondenceFolder.direction == _direction_or_400(direction),
    ).group_by(
        CorrespondenceFolder.id,
        CorrespondenceFolder.name,
        CorrespondenceFolder.direction,
        CorrespondenceFolder.parent_id,
        CorrespondenceFolder.created_at,
    ).order_by(CorrespondenceFolder.name.asc()).all()
    return [{"id": row.id, "name": row.name, "direction": row.direction, "parent_id": row.parent_id,
             "created_at": row.created_at, "item_count": row.item_count} for row in rows]


@router.post("/folders")
def create_folder(payload: FolderIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.parent_id:
        parent = db.query(CorrespondenceFolder).filter(
            CorrespondenceFolder.id == payload.parent_id,
            CorrespondenceFolder.owner_id == user.id,
            CorrespondenceFolder.direction == payload.direction,
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="Thư mục cha không hợp lệ.")
    folder = CorrespondenceFolder(name=payload.name, direction=payload.direction, owner_id=user.id, parent_id=payload.parent_id)
    db.add(folder)
    db.flush()
    _audit(db, user, "CORR_FOLDER_CREATE", None, request)
    db.commit()
    return {"id": folder.id, "name": folder.name, "direction": folder.direction, "parent_id": folder.parent_id, "item_count": 0}


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    folder = db.query(CorrespondenceFolder).filter(CorrespondenceFolder.id == folder_id, CorrespondenceFolder.owner_id == user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại.")
    db.delete(folder)
    _audit(db, user, "CORR_FOLDER_DELETE", None, request)
    db.commit()
    return {"success": True}


@router.post("/folders/{folder_id}/documents")
def move_documents_to_folder(folder_id: str, payload: FolderDocumentsIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    folder = db.query(CorrespondenceFolder).filter(CorrespondenceFolder.id == folder_id, CorrespondenceFolder.owner_id == user.id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Thư mục không tồn tại.")
    docs = db.query(CorrespondenceDocument).filter(CorrespondenceDocument.id.in_(payload.document_ids)).all()
    if len(docs) != len(set(payload.document_ids)) or any(doc.direction != folder.direction or not can_view_corr(user, doc) for doc in docs):
        raise HTTPException(status_code=400, detail="Có công văn không hợp lệ hoặc không có quyền xem.")
    # Each user can place a document in one folder; adding it here moves it.
    db.query(CorrespondenceFolderItem).filter(
        CorrespondenceFolderItem.owner_id == user.id,
        CorrespondenceFolderItem.correspondence_id.in_(payload.document_ids),
    ).delete(synchronize_session=False)
    db.add_all([CorrespondenceFolderItem(folder_id=folder.id, correspondence_id=doc.id, owner_id=user.id) for doc in docs])
    _audit(db, user, "CORR_FOLDER_MOVE", None, request)
    db.commit()
    return {"success": True}


# ---------- CRUD ----------

def _create(direction: str, payload: CorrCreate, db: Session, user: User, request: Request | None = None):
    folder = _get_personal_folder(db, user, direction, payload.folder_id) if payload.folder_id else None
    try:
        doc = svc.create_document(db, direction, payload.model_dump(), user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _audit(db, user, "CORR_CREATE", doc.id, request)
    if folder:
        db.add(CorrespondenceFolderItem(folder_id=folder.id, correspondence_id=doc.id, owner_id=user.id))
    db.commit()
    return doc


@router.post("/incoming", response_model=CorrOut)
def create_incoming(payload: CorrCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _create("INCOMING", payload, db, user, request)


@router.post("/outgoing", response_model=CorrOut)
def create_outgoing(payload: CorrCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _create("OUTGOING", payload, db, user, request)


@router.post("/internal", response_model=CorrOut)
def create_internal(payload: CorrCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _create("INTERNAL", payload, db, user, request)


@router.get("/incoming/{corr_id}", response_model=CorrOut)
def get_incoming(corr_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _get_or_404(db, "INCOMING", corr_id)
    _require_view(user, doc)
    return doc


@router.get("/outgoing/{corr_id}", response_model=CorrOut)
def get_outgoing(corr_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _get_or_404(db, "OUTGOING", corr_id)
    _require_view(user, doc)
    return doc


@router.get("/internal/{corr_id}", response_model=CorrOut)
def get_internal(corr_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    doc = _get_or_404(db, "INTERNAL", corr_id)
    _require_view(user, doc)
    return doc


def _update(direction: str, corr_id: str, payload: CorrUpdate, db: Session, user: User, request: Request | None = None):
    doc = _get_or_404(db, direction, corr_id)
    _require_edit(user, doc)
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if data:
        data = svc._norm_dates(data)
        merged = {c.name: getattr(doc, c.name) for c in doc.__table__.columns if c.name not in ("id",)}
        merged.update(data)
        errors = svc.validate_payload(db, direction, merged, exclude_id=doc.id)
        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))
        for k, v in data.items():
            if k in ("attachment_ids", "links"):
                continue
            if k in ("recipient", "sender", "signer", "issuing_department", "notes") and isinstance(v, str):
                from app.database.database import normalize_text
                v = normalize_text(v.strip()) or None
            if k == "visibility" and isinstance(v, str):
                from app.core.permissions import VISIBILITIES
                v = v.upper()
                if v not in VISIBILITIES:
                    raise HTTPException(status_code=400, detail="Phạm vi chia sẻ không hợp lệ.")
            if k == "department" and isinstance(v, str):
                from app.database.database import normalize_text
                v = normalize_text(v.strip()) or None
            setattr(doc, k, v)
        if doc.visibility == "DEPARTMENT" and not doc.department:
            raise HTTPException(status_code=400, detail="Chia sẻ theo phòng ban thì phải chọn phòng ban.")
        if "attachment_ids" in data:
            try:
                # Reconcile: drop removed links to files, add new ones.
                # Physical files are always kept (shared storage policy).
                wanted = set(data["attachment_ids"] or [])
                for att in [a for a in doc.attachments if a.document_id not in wanted]:
                    db.delete(att)
                db.flush()
                svc.attach_documents(db, doc, data["attachment_ids"] or [], viewer_id=user.id)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        if "links" in data:
            svc.replace_links(db, doc, data["links"] or [])
    _audit(db, user, "CORR_UPDATE", doc.id, request)
    db.commit()
    db.refresh(doc)
    return doc


@router.put("/incoming/{corr_id}", response_model=CorrOut)
def update_incoming(corr_id: str, payload: CorrUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _update("INCOMING", corr_id, payload, db, user, request)


@router.put("/outgoing/{corr_id}", response_model=CorrOut)
def update_outgoing(corr_id: str, payload: CorrUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _update("OUTGOING", corr_id, payload, db, user, request)


@router.put("/internal/{corr_id}", response_model=CorrOut)
def update_internal(corr_id: str, payload: CorrUpdate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _update("INTERNAL", corr_id, payload, db, user, request)


def _delete(direction: str, corr_id: str, db: Session, user: User, request: Request | None = None):
    doc = _get_or_404(db, direction, corr_id)
    _require_delete(user, doc)
    _audit(db, user, "CORR_DELETE", doc.id, request)
    db.delete(doc)  # attachments/links cascade; physical files in documents are kept
    db.commit()
    return {"success": True}


@router.delete("/incoming/{corr_id}")
def delete_incoming(corr_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _delete("INCOMING", corr_id, db, user, request)


@router.delete("/outgoing/{corr_id}")
def delete_outgoing(corr_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _delete("OUTGOING", corr_id, db, user, request)


@router.delete("/internal/{corr_id}")
def delete_internal(corr_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _delete("INTERNAL", corr_id, db, user, request)


@router.delete("/{direction}/{corr_id}/attachments/{att_id}")
def remove_attachment(direction: str, corr_id: str, att_id: str, request: Request,
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = _direction_or_400(direction)
    doc = _get_or_404(db, d, corr_id)
    _require_edit(user, doc)
    att = next((a for a in doc.attachments if a.id == att_id), None)
    if not att:
        raise HTTPException(status_code=404, detail="Tệp đính kèm không tồn tại.")
    db.delete(att)  # physical file kept (shared storage policy)
    _audit(db, user, "CORR_DETACH", doc.id, request)
    db.commit()
    return {"success": True}


@router.delete("/{direction}/{corr_id}/links/{link_id}")
def remove_link(direction: str, corr_id: str, link_id: str, request: Request,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = _direction_or_400(direction)
    doc = _get_or_404(db, d, corr_id)
    _require_edit(user, doc)
    link = db.query(CorrespondenceLink).filter(
        CorrespondenceLink.id == link_id,
        CorrespondenceLink.correspondence_id == doc.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Liên kết không tồn tại.")
    db.delete(link)
    _audit(db, user, "CORR_UNLINK", doc.id, request)
    db.commit()
    return {"success": True}


# ---------- Import ----------

@router.post("/incoming/import", response_model=ImportResult)
def import_incoming(payload: dict, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = svc.import_rows(db, "INCOMING", payload.get("rows") or [], user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _audit(db, user, "CORR_IMPORT", None, request)
    db.commit()
    return result


@router.post("/outgoing/import", response_model=ImportResult)
def import_outgoing(payload: dict, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = svc.import_rows(db, "OUTGOING", payload.get("rows") or [], user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _audit(db, user, "CORR_IMPORT", None, request)
    db.commit()
    return result


@router.post("/internal/import", response_model=ImportResult)
def import_internal(payload: dict, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        result = svc.import_rows(db, "INTERNAL", payload.get("rows") or [], user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _audit(db, user, "CORR_IMPORT", None, request)
    db.commit()
    return result


# ---------- Types ----------

@router.get("/types", response_model=list[DocTypeOut])
def list_types(active_only: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(DocumentType).order_by(DocumentType.code)
    if active_only:
        q = q.filter(DocumentType.status == "ACTIVE")
    return q.all()


@router.post("/types", response_model=DocTypeOut)
def create_type(payload: DocTypeIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(DocumentType).filter(DocumentType.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Mã loại '{payload.code}' đã tồn tại.")
    t = DocumentType(code=payload.code, name=payload.name, description=payload.description,
                     status=payload.status, default_signer=payload.default_signer)
    db.add(t)
    _audit(db, admin, "TYPE_CREATE", None, request)
    db.commit()
    db.refresh(t)
    return t


@router.put("/types/{type_id}", response_model=DocTypeOut)
def update_type(type_id: str, payload: DocTypeIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    t = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Loại văn bản không tồn tại.")
    if payload.code != t.code and db.query(DocumentType).filter(DocumentType.code == payload.code).first():
        raise HTTPException(status_code=409, detail=f"Mã loại '{payload.code}' đã tồn tại.")
    t.code, t.name, t.description, t.status, t.default_signer = \
        payload.code, payload.name, payload.description, payload.status, payload.default_signer
    _audit(db, admin, "TYPE_UPDATE", None, request)
    db.commit()
    db.refresh(t)
    return t


@router.delete("/types/{type_id}")
def delete_type(type_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    t = db.query(DocumentType).filter(DocumentType.id == type_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Loại văn bản không tồn tại.")
    used = db.query(CorrespondenceDocument).filter(CorrespondenceDocument.document_type_id == type_id).count()
    if used:
        raise HTTPException(status_code=409, detail=f"Loại văn bản đang được dùng bởi {used} văn bản. Hãy deactivate thay vì xóa.")
    db.delete(t)
    _audit(db, admin, "TYPE_DELETE", None, request)
    db.commit()
    return {"success": True}


# ---------- Settings / numbering ----------

@router.get("/settings", response_model=list[NumberConfigOut])
def get_settings(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [svc.get_or_create_number_config(db, d) for d in DIRECTIONS]


@router.put("/settings/{direction}", response_model=NumberConfigOut)
def update_settings(direction: str, payload: NumberConfigIn, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    d = _direction_or_400(direction)
    cfg = svc.get_or_create_number_config(db, d)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(cfg, k, v)
    _audit(db, admin, "NUMBERING_UPDATE", None, request)
    db.commit()
    db.refresh(cfg)
    return cfg


@router.get("/next-number")
def next_number(direction: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d = _direction_or_400(direction)
    cfg = svc.get_or_create_number_config(db, d)
    return {"direction": d, "next_number": svc.format_number(cfg)}


# ---------- Suggestions ----------

@router.get("/departments", response_model=list[str])
def list_departments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(CorrespondenceDocument.issuing_department).distinct().limit(100).all()
    return sorted({r[0] for r in rows if r[0]})


@router.get("/signers", response_model=list[str])
def list_signers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(CorrespondenceDocument.signer).distinct().limit(100).all()
    return sorted({r[0] for r in rows if r[0]})

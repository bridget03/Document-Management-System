from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.database.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import PaginatedAudit

router = APIRouter(prefix="/audit-logs", tags=["audit"])


@router.get("", response_model=PaginatedAudit)
def list_audit_logs(
    q: str | None = None,
    action: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)
    if action:
        query = query.filter(AuditLog.action == action.upper())
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (User.email.ilike(like)) | (User.name.ilike(like)) | (AuditLog.ip_address.ilike(like))
        )
    total = query.count()
    rows = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [
        {
            "id": a.id,
            "user_id": a.user_id,
            "user_name": u.name if u else None,
            "user_email": u.email if u else None,
            "action": a.action,
            "document_id": a.document_id,
            "correspondence_id": a.correspondence_id,
            "ip_address": a.ip_address or None,
            "created_at": a.created_at.isoformat() if a.created_at else "",
        }
        for a, u in rows
    ]
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
    }

"""Central audit logging. Call log() for security-relevant actions.

Stores actor, action, object refs + client IP / user-agent so the audit
viewer (GET /api/audit-logs) can trace who did what, from where.
"""
from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def client_info(request: Request | None) -> tuple[str, str]:
    if request is None:
        return "", ""
    ip = request.client.host if request.client else ""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        ip = fwd.split(",")[0].strip()
    ua = (request.headers.get("user-agent") or "")[:500]
    return ip or "", ua


def log(
    db: Session,
    user_id: str | None,
    action: str,
    document_id: str | None = None,
    correspondence_id: str | None = None,
    request: Request | None = None,
) -> AuditLog:
    ip, ua = client_info(request)
    entry = AuditLog(
        user_id=user_id,
        action=action,
        document_id=document_id,
        correspondence_id=correspondence_id,
        ip_address=ip,
        user_agent=ua,
    )
    db.add(entry)
    return entry

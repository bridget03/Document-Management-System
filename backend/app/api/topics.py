from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db, normalize_text
from app.models.topic import Topic
from app.models.user import User
from app.schemas.topic import TopicIn, TopicOut

router = APIRouter(prefix="/topics", tags=["topics"])


def _audit(db: Session, user: User, action: str, request: Request | None = None):
    from app.services.audit_service import log as audit_log
    audit_log(db, user.id, action, request=request)


@router.get("", response_model=list[TopicOut])
def list_topics(
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Topic).order_by(Topic.name)
    if active_only:
        q = q.filter(Topic.status == "ACTIVE")
    return q.all()


@router.post("", response_model=TopicOut)
def create_topic(
    payload: TopicIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    name = normalize_text(payload.name.strip())
    dup = db.query(Topic).filter(func.lower(Topic.name) == name.lower()).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Vấn đề '{name}' đã tồn tại.")
    u = Topic(name=name, status=payload.status)
    db.add(u)
    _audit(db, admin, "TOPIC_CREATE", request)
    db.commit()
    db.refresh(u)
    return u


@router.put("/{topic_id}", response_model=TopicOut)
def update_topic(
    topic_id: str,
    payload: TopicIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = db.query(Topic).filter(Topic.id == topic_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Vấn đề không tồn tại.")
    name = normalize_text(payload.name.strip())
    dup = db.query(Topic).filter(
        func.lower(Topic.name) == name.lower(),
        Topic.id != topic_id,
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Vấn đề '{name}' đã tồn tại.")
    u.name, u.status = name, payload.status
    _audit(db, admin, "TOPIC_UPDATE", request)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{topic_id}")
def delete_topic(
    topic_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = db.query(Topic).filter(Topic.id == topic_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Vấn đề không tồn tại.")
    # Không FK tới bảng khác (công văn lưu tên text) nên xóa an toàn;
    # văn bản cũ giữ nguyên tên text đã lưu.
    db.delete(u)
    _audit(db, admin, "TOPIC_DELETE", request)
    db.commit()
    return {"success": True}

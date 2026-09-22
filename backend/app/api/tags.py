from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db, normalize_text
from app.models.tag import Tag
from app.services.audit_service import log as audit_log
from app.models.user import User
from app.schemas.tag import TagCreate, TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Tag).order_by(Tag.name).all()


@router.post("", response_model=TagOut)
def create_tag(payload: TagCreate, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    name = normalize_text(payload.name) or payload.name
    existing = db.query(Tag).filter(Tag.name == name).first()
    if existing:
        return existing
    tag = Tag(name=name)
    db.add(tag)
    audit_log(db, user.id, "TAG_CREATE", request=request)
    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    db.delete(tag)
    audit_log(db, admin.id, "TAG_DELETE", request=request)
    db.commit()
    return {"success": True}

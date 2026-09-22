from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db, normalize_text
from app.models.category import Category
from app.services.audit_service import log as audit_log
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Category).order_by(Category.name).all()


@router.post("", response_model=CategoryOut)
def create_category(payload: CategoryCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    name = normalize_text(payload.name) or payload.name
    if db.query(Category).filter(Category.name == name).first():
        raise HTTPException(status_code=409, detail="Category already exists")
    cat = Category(name=name, description=normalize_text(payload.description))
    db.add(cat)
    audit_log(db, admin.id, "CATEGORY_CREATE", request=request)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: str, payload: CategoryCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    name = normalize_text(payload.name) or payload.name
    dup = db.query(Category).filter(Category.name == name, Category.id != cat_id).first()
    if dup:
        raise HTTPException(status_code=409, detail="Category already exists")
    cat.name = name
    cat.description = normalize_text(payload.description)
    audit_log(db, admin.id, "CATEGORY_UPDATE", request=request)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{cat_id}")
def delete_category(cat_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cat = db.query(Category).filter(Category.id == cat_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    db.delete(cat)
    audit_log(db, admin.id, "CATEGORY_DELETE", request=request)
    db.commit()
    return {"success": True}

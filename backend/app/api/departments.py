from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db, normalize_text
from app.models.department import Department
from app.models.user import User
from app.schemas.department import DepartmentIn, DepartmentOut

router = APIRouter(prefix="/departments", tags=["departments"])


def _audit(db: Session, user: User, action: str, request: Request | None = None):
    from app.services.audit_service import log as audit_log
    audit_log(db, user.id, action, request=request)


@router.get("", response_model=list[DepartmentOut])
def list_departments(
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Department).order_by(Department.name)
    if active_only:
        q = q.filter(Department.status == "ACTIVE")
    return q.all()


@router.post("", response_model=DepartmentOut)
def create_department(
    payload: DepartmentIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    name = normalize_text(payload.name.strip())
    dup = db.query(Department).filter(func.lower(Department.name) == name.lower()).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Phòng ban '{name}' đã tồn tại.")
    d = Department(name=name, status=payload.status)
    db.add(d)
    _audit(db, admin, "DEPT_CREATE", request)
    db.commit()
    db.refresh(d)
    return d


@router.put("/{dept_id}", response_model=DepartmentOut)
def update_department(
    dept_id: str,
    payload: DepartmentIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại.")
    name = normalize_text(payload.name.strip())
    dup = db.query(Department).filter(
        func.lower(Department.name) == name.lower(),
        Department.id != dept_id,
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Phòng ban '{name}' đã tồn tại.")
    d.name, d.status = name, payload.status
    _audit(db, admin, "DEPT_UPDATE", request)
    db.commit()
    db.refresh(d)
    return d


@router.delete("/{dept_id}")
def delete_department(
    dept_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    d = db.query(Department).filter(Department.id == dept_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Phòng ban không tồn tại.")
    # Không FK tới bảng khác (các nơi lưu tên text) nên xóa an toàn;
    # văn bản cũ giữ nguyên tên text đã lưu.
    db.delete(d)
    _audit(db, admin, "DEPT_DELETE", request)
    db.commit()
    return {"success": True}

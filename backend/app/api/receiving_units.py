from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_admin
from app.database.database import get_db, normalize_text
from app.models.receiving_unit import ReceivingUnit
from app.models.user import User
from app.schemas.receiving_unit import ReceivingUnitIn, ReceivingUnitOut

router = APIRouter(prefix="/receiving-units", tags=["receiving-units"])


def _audit(db: Session, user: User, action: str, request: Request | None = None):
    from app.services.audit_service import log as audit_log
    audit_log(db, user.id, action, request=request)


@router.get("", response_model=list[ReceivingUnitOut])
def list_receiving_units(
    active_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ReceivingUnit).order_by(ReceivingUnit.name)
    if active_only:
        q = q.filter(ReceivingUnit.status == "ACTIVE")
    return q.all()


@router.post("", response_model=ReceivingUnitOut)
def create_receiving_unit(
    payload: ReceivingUnitIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    name = normalize_text(payload.name.strip())
    dup = db.query(ReceivingUnit).filter(func.lower(ReceivingUnit.name) == name.lower()).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Đơn vị '{name}' đã tồn tại.")
    u = ReceivingUnit(name=name, status=payload.status)
    db.add(u)
    _audit(db, admin, "RECV_UNIT_CREATE", request)
    db.commit()
    db.refresh(u)
    return u


@router.put("/{unit_id}", response_model=ReceivingUnitOut)
def update_receiving_unit(
    unit_id: str,
    payload: ReceivingUnitIn,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = db.query(ReceivingUnit).filter(ReceivingUnit.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Đơn vị tiếp nhận không tồn tại.")
    name = normalize_text(payload.name.strip())
    dup = db.query(ReceivingUnit).filter(
        func.lower(ReceivingUnit.name) == name.lower(),
        ReceivingUnit.id != unit_id,
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail=f"Đơn vị '{name}' đã tồn tại.")
    u.name, u.status = name, payload.status
    _audit(db, admin, "RECV_UNIT_UPDATE", request)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{unit_id}")
def delete_receiving_unit(
    unit_id: str,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    u = db.query(ReceivingUnit).filter(ReceivingUnit.id == unit_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Đơn vị tiếp nhận không tồn tại.")
    # Không FK tới bảng khác (công văn lưu tên text) nên xóa an toàn;
    # văn bản cũ giữ nguyên tên text đã lưu.
    db.delete(u)
    _audit(db, admin, "RECV_UNIT_DELETE", request)
    db.commit()
    return {"success": True}

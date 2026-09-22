import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse, UserCreate, UserOut, UserUpdate
from app.services.audit_service import log as audit_log
from app.services.auth_service import authenticate, issue_token
from app.core.security import hash_password
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def error(code: str, message: str, status_code: int):
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = authenticate(db, payload.email, payload.password)
    if not user:
        audit_log(db, None, "LOGIN_FAIL", request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        audit_log(db, user.id, "LOGIN_FAIL", request=request)
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    token = issue_token(user)
    audit_log(db, user.id, "LOGIN", request=request)
    db.commit()
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    audit_log(db, None, "LOGOUT", request=request)
    db.commit()
    return {"success": True, "message": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    role = payload.role if payload.role in ("ADMIN", "USER") else "USER"
    dept = (payload.department or "").strip() or None
    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password), role=role, department=dept)
    db.add(user)
    db.flush()
    audit_log(db, admin.id, "USER_CREATE", request=request)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at).all()


def _get_user_or_404(db: Session, user_id: str) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Người dùng không tồn tại.")
    return user


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = _get_user_or_404(db, user_id)
    if payload.role is not None:
        if payload.role not in ("ADMIN", "USER"):
            raise HTTPException(status_code=400, detail="Role không hợp lệ.")
        if user.id == admin.id and payload.role != admin.role:
            raise HTTPException(status_code=400, detail="Không thể tự đổi role của chính mình.")
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == admin.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="Không thể tự khóa tài khoản của chính mình.")
        user.is_active = payload.is_active
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Tên không được để trống.")
        user.name = name
    if "department" in payload.model_fields_set:
        user.department = (payload.department or "").strip() or None
    audit_log(db, admin.id, "USER_UPDATE", request=request)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, request: Request, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    user = _get_user_or_404(db, user_id)
    temp = secrets.token_urlsafe(12)
    user.password_hash = hash_password(temp)
    audit_log(db, admin.id, "USER_RESET_PASSWORD", request=request)
    db.commit()
    # Trả về 1 lần duy nhất — admin phải gửi cho user qua kênh an toàn.
    return {"success": True, "user_id": user.id, "temporary_password": temp}

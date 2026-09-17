from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse, UserCreate, UserOut
from app.services.auth_service import authenticate, issue_token
from app.core.security import hash_password
from app.core.dependencies import get_current_user, require_admin
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


def error(code: str, message: str, status_code: int):
    raise HTTPException(status_code=status_code, detail={"code": code, "message": message})


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate(db, payload.email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    token = issue_token(user)
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/logout")
def logout():
    return {"success": True, "message": "Logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    role = payload.role if payload.role in ("ADMIN", "USER") else "USER"
    user = User(name=payload.name, email=payload.email, password_hash=hash_password(payload.password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).all()

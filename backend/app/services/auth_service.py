from sqlalchemy.orm import Session
from app.models.user import User
from app.core.security import verify_password, create_access_token


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


def issue_token(user: User) -> str:
    return create_access_token(subject=user.id)

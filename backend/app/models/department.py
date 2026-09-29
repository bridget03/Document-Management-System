import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String

from app.database.database import Base


class Department(Base):
    """Danh mục phòng ban dùng chung: chia sẻ công văn/tài liệu + gán phòng cho user.

    Các bảng khác lưu tên phòng ban dạng text (có thể multi "A; B"),
    không FK để dữ liệu cũ nhập tự do vẫn tương thích.
    """

    __tablename__ = "departments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

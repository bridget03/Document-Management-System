import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String

from app.database.database import Base


class Topic(Base):
    """Danh mục vấn đề cho công văn nội bộ (dropdown "Vấn đề").

    Công văn lưu tên dạng text (không FK) để dữ liệu cũ nhập tự do
    vẫn tương thích, giống cách Department/ReceivingUnit làm.
    """

    __tablename__ = "topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True, index=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


DEFAULT_TOPICS = ["Lương", "Nhân sự", "Vi phạm", "Môi trường"]

import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text

from app.database.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=True, index=True)
    action = Column(String(50), nullable=False, index=True)
    document_id = Column(String(36), nullable=True, index=True)
    correspondence_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(100), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

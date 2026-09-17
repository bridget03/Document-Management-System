import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String, Text

from app.database.database import Base


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_id = Column(String(36), nullable=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False, default="RUNNING")
    total_files = Column(Integer, default=0)
    created_files = Column(Integer, default=0)
    updated_files = Column(Integer, default=0)
    deleted_files = Column(Integer, default=0)
    failed_files = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)

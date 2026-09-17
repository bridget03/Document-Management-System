import uuid
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint

from app.database.database import Base


class GoogleDriveSyncFile(Base):
    """Individually selected Drive files for FILES-scope sync (metadata only)."""

    __tablename__ = "google_drive_sync_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    config_id = Column(String(36), ForeignKey("google_drive_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    google_drive_file_id = Column(String(255), nullable=False, index=True)
    file_name = Column(String(500), nullable=True)
    mime_type = Column(String(255), nullable=True)
    google_drive_parent_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("config_id", "google_drive_file_id", name="uq_sync_file"),)

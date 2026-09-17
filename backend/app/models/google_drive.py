import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.database.database import Base


class GoogleDriveConfig(Base):
    __tablename__ = "google_drive_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    drive_id = Column(String(255), nullable=True)
    folder_id = Column(String(255), nullable=True)
    folder_name = Column(String(500), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    connected_email = Column(String(255), nullable=True)
    # Sync scope: FOLDER (entire folder, default for old configs) or FILES (selected files only).
    sync_scope = Column(String(20), nullable=False, default="FOLDER")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

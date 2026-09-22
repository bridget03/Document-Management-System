import uuid
from datetime import datetime
from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.database.database import Base
from app.models.tag import document_tags


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(500), nullable=False)
    original_name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    mime_type = Column(String(255), nullable=True)
    file_extension = Column(String(50), nullable=True, index=True)
    file_size = Column(BigInteger, nullable=True)

    storage_type = Column(String(50), nullable=False, default="LOCAL")
    local_file_path = Column(Text, nullable=True)

    google_drive_file_id = Column(String(255), unique=True, nullable=True, index=True)
    google_drive_url = Column(Text, nullable=True)
    google_drive_parent_id = Column(String(255), nullable=True)

    category_id = Column(String(36), ForeignKey("categories.id"), nullable=True, index=True)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)

    source = Column(String(50), nullable=False, default="LOCAL_UPLOAD")
    sync_status = Column(String(50), nullable=False, default="NOT_SYNCED")

    # Sharing scope: ORGANIZATION (everyone, legacy default) | DEPARTMENT
    # (same department + owner + ADMIN) | PRIVATE (owner + ADMIN only).
    visibility = Column(String(20), nullable=False, default="ORGANIZATION")
    department = Column(String(255), nullable=True, index=True)

    google_drive_modified_at = Column(DateTime, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags = relationship("Tag", secondary=document_tags, lazy="selectin")
    category = relationship("Category", lazy="selectin")

import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database.database import Base


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    default_signer = Column(String(255), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class CorrespondenceNumberConfig(Base):
    __tablename__ = "correspondence_number_configs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    direction = Column(String(20), nullable=False, unique=True, index=True)
    current_number = Column(Integer, nullable=False, default=0)
    number_length = Column(Integer, nullable=False, default=3)
    prefix = Column(String(50), nullable=True, default="")
    suffix = Column(String(100), nullable=True, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class CorrespondenceDocument(Base):
    __tablename__ = "correspondence_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    direction = Column(String(20), nullable=False, index=True)
    document_number = Column(String(255), nullable=False, index=True)
    recipient = Column(String(500), nullable=True)
    sender = Column(String(500), nullable=True)
    quantity = Column(Integer, nullable=True)
    signer = Column(String(255), nullable=True)
    security_level = Column(String(20), nullable=True)
    urgency_level = Column(String(20), nullable=True)
    signed_date = Column(Date, nullable=True)
    effective_date = Column(Date, nullable=True)
    expiry_date = Column(Date, nullable=True)
    issuing_department = Column(String(255), nullable=True, index=True)
    issue_date = Column(Date, nullable=True, index=True)
    document_type_id = Column(String(36), ForeignKey("document_types.id"), nullable=True, index=True)
    processing_status = Column(String(30), nullable=False, default="DRAFT", index=True)
    notes = Column(Text, nullable=True)
    # Sharing scope, same semantics as documents.visibility.
    visibility = Column(String(20), nullable=False, default="ORGANIZATION")
    department = Column(String(255), nullable=True, index=True)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    doc_type = relationship("DocumentType", lazy="selectin")
    creator = relationship("User", lazy="selectin")
    attachments = relationship("CorrespondenceAttachment", cascade="all, delete-orphan", lazy="selectin")
    links = relationship("CorrespondenceLink", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (UniqueConstraint("direction", "document_number", name="uq_corr_direction_number"),)


class CorrespondenceAttachment(Base):
    __tablename__ = "correspondence_attachments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    correspondence_id = Column(String(36), ForeignKey("correspondence_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    # References documents.id but never cascades: deleting a correspondence
    # must NOT delete the shared physical file (existing deletion policy).
    document_id = Column(String(36), ForeignKey("documents.id"), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    document = relationship("Document", lazy="selectin")


class CorrespondenceLink(Base):
    __tablename__ = "correspondence_links"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    correspondence_id = Column(String(36), ForeignKey("correspondence_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    url = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

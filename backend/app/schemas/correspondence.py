from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, field_validator

Direction = Literal["INCOMING", "OUTGOING", "INTERNAL"]
DocStatus = Literal["DRAFT", "APPROVED", "PENDING_SIGNATURE", "ISSUED"]
Level = Literal["LOW", "MEDIUM", "HIGH"]
TypeStatus = Literal["ACTIVE", "INACTIVE"]


# ---------- Document types ----------

class DocTypeIn(BaseModel):
    code: str
    name: str
    description: str | None = None
    status: TypeStatus = "ACTIVE"
    default_signer: str | None = None

    @field_validator("code", "name")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("must not be empty")
        return v


class DocTypeOut(BaseModel):
    id: str
    code: str
    name: str
    description: str | None = None
    status: str
    default_signer: str | None = None

    class Config:
        from_attributes = True


# ---------- Numbering ----------

class NumberConfigOut(BaseModel):
    id: str
    direction: str
    current_number: int
    number_length: int
    prefix: str | None = None
    suffix: str | None = None

    class Config:
        from_attributes = True


class NumberConfigIn(BaseModel):
    current_number: int | None = None
    number_length: int | None = None
    prefix: str | None = None
    suffix: str | None = None

    @field_validator("current_number")
    @classmethod
    def _nonneg(cls, v):
        if v is not None and v < 0:
            raise ValueError("current_number must be >= 0")
        return v

    @field_validator("number_length")
    @classmethod
    def _positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError("number_length must be > 0")
        return v


# ---------- Correspondence ----------

class LinkIn(BaseModel):
    name: str
    url: str


class CorrCreate(BaseModel):
    document_number: str
    recipient: str | None = None
    sender: str | None = None
    quantity: int | None = None
    signer: str | None = None
    security_level: str | None = None
    urgency_level: str | None = None
    signed_date: date | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    issuing_department: str | None = None
    issue_date: date | None = None
    document_type_id: str | None = None
    processing_status: str = "DRAFT"
    notes: str | None = None
    visibility: str = "ORGANIZATION"
    department: str | None = None
    attachment_ids: list[str] = []
    links: list[LinkIn] = []


class CorrUpdate(BaseModel):
    document_number: str | None = None
    recipient: str | None = None
    sender: str | None = None
    quantity: int | None = None
    signer: str | None = None
    security_level: str | None = None
    urgency_level: str | None = None
    signed_date: date | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    issuing_department: str | None = None
    issue_date: date | None = None
    document_type_id: str | None = None
    processing_status: str | None = None
    notes: str | None = None
    visibility: str | None = None
    department: str | None = None
    attachment_ids: list[str] | None = None
    links: list[LinkIn] | None = None


class CreatorOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class AttachmentDocOut(BaseModel):
    id: str
    name: str
    mime_type: str | None = None
    file_extension: str | None = None
    file_size: int | None = None
    source: str

    class Config:
        from_attributes = True


class AttachmentOut(BaseModel):
    id: str
    document_id: str
    document: AttachmentDocOut | None = None

    class Config:
        from_attributes = True


class LinkOut(BaseModel):
    id: str
    name: str
    url: str

    class Config:
        from_attributes = True


class CorrOut(BaseModel):
    id: str
    direction: str
    document_number: str
    recipient: str | None = None
    sender: str | None = None
    quantity: int | None = None
    signer: str | None = None
    security_level: str | None = None
    urgency_level: str | None = None
    signed_date: date | None = None
    effective_date: date | None = None
    expiry_date: date | None = None
    issuing_department: str | None = None
    issue_date: date | None = None
    document_type_id: str | None = None
    doc_type: DocTypeOut | None = None
    processing_status: str
    notes: str | None = None
    visibility: str = "ORGANIZATION"
    department: str | None = None
    created_by: str | None = None
    creator: CreatorOut | None = None
    attachments: list[AttachmentOut] = []
    links: list[LinkOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PaginatedCorr(BaseModel):
    items: list[CorrOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class ImportRowError(BaseModel):
    row: int
    errors: list[str]


class ImportResult(BaseModel):
    total: int
    success: int
    failed: int
    errors: list[ImportRowError] = []

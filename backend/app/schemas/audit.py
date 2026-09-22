from pydantic import BaseModel


class AuditOut(BaseModel):
    id: str
    user_id: str | None = None
    user_name: str | None = None
    user_email: str | None = None
    action: str
    document_id: str | None = None
    correspondence_id: str | None = None
    ip_address: str | None = None
    created_at: str

    class Config:
        from_attributes = True


class PaginatedAudit(BaseModel):
    items: list[AuditOut]
    page: int
    page_size: int
    total: int
    total_pages: int

from datetime import datetime
from pydantic import BaseModel


class TagOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class CategoryOut(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class DocumentOut(BaseModel):
    id: str
    name: str
    original_name: str
    description: str | None = None
    mime_type: str | None = None
    file_extension: str | None = None
    file_size: int | None = None
    storage_type: str
    category_id: str | None = None
    category: CategoryOut | None = None
    uploaded_by: str | None = None
    source: str
    sync_status: str
    visibility: str = "ORGANIZATION"
    department: str | None = None
    google_drive_file_id: str | None = None
    google_drive_url: str | None = None
    created_at: datetime
    updated_at: datetime
    tags: list[TagOut] = []

    class Config:
        from_attributes = True


class DocumentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    category_id: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None
    department: str | None = None


class PaginatedDocuments(BaseModel):
    items: list[DocumentOut]
    page: int
    page_size: int
    total: int
    total_pages: int

from sqlalchemy import or_
from sqlalchemy.orm import Query
from app.database.database import normalize_text
from app.models.document import Document
from app.models.category import Category
from app.models.tag import Tag


def apply_filters(
    query: Query,
    q: str | None = None,
    category_id: str | None = None,
    tag_id: str | None = None,
    file_extension: str | None = None,
    mime_type: str | None = None,
    uploaded_by: str | None = None,
    source: str | None = None,
    sync_status: str | None = None,
    created_from=None,
    created_to=None,
    updated_from=None,
    updated_to=None,
) -> Query:
    if q:
        q = normalize_text(q) or q
        like = f"%{q}%"
        query = query.outerjoin(Category, Document.category_id == Category.id).outerjoin(
            Document.tags
        )
        query = query.filter(
            or_(
                Document.name.ilike(like),
                Document.original_name.ilike(like),
                Document.description.ilike(like),
                Category.name.ilike(like),
                Tag.name.ilike(like),
            )
        )
    if category_id:
        query = query.filter(Document.category_id == category_id)
    if tag_id:
        query = query.filter(Document.tags.any(Tag.id == tag_id))
    if file_extension:
        query = query.filter(Document.file_extension == file_extension.lower())
    if mime_type:
        query = query.filter(Document.mime_type == mime_type)
    if uploaded_by:
        query = query.filter(Document.uploaded_by == uploaded_by)
    if source:
        query = query.filter(Document.source == source)
    if sync_status:
        query = query.filter(Document.sync_status == sync_status)
    if created_from:
        query = query.filter(Document.created_at >= created_from)
    if created_to:
        query = query.filter(Document.created_at <= created_to)
    if updated_from:
        query = query.filter(Document.updated_at >= updated_from)
    if updated_to:
        query = query.filter(Document.updated_at <= updated_to)
    return query.distinct()

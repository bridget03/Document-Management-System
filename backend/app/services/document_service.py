ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "jpg", "jpeg", "png", "webp", "zip"}

EXTENSION_MIME = {
    "pdf": "application/pdf",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "txt": "text/plain",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "zip": "application/zip",
}


def validate_file(filename: str, mime_type: str | None, size: int, max_bytes: int) -> tuple[str, str]:
    if size > max_bytes:
        raise ValueError(f"File too large (max {max_bytes} bytes)")
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "")
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extension .{ext} not allowed")
    # Do not trust client mime; derive expected, accept generic octet-stream too
    expected = EXTENSION_MIME.get(ext)
    if mime_type and expected and mime_type not in (expected, "application/octet-stream"):
        # Allow image/* variants and office leniency: only hard-fail executables
        if mime_type.startswith("application/x-ms") or "executable" in mime_type or mime_type in (
            "application/x-sh", "application/x-executable",
        ):
            raise ValueError("MIME type not allowed")
    return ext, expected or (mime_type or "application/octet-stream")


def sanitize_filename(name: str) -> str:
    import unicodedata

    cleaned = name.replace("/", "_").replace("\\", "_").strip()[:500] or "unnamed"
    return unicodedata.normalize("NFC", cleaned)


def backfill_nfc(db) -> int:
    """One-off normalization of legacy rows (e.g. NFD names from Drive/macOS).

    Returns the number of rows updated. Safe to run repeatedly.
    """
    import unicodedata

    from app.models.category import Category
    from app.models.document import Document
    from app.models.tag import Tag

    def fix(value: str | None) -> str | None:
        if not value:
            return value
        nfc = unicodedata.normalize("NFC", value)
        return nfc if nfc != value else value

    updated = 0
    for doc in db.query(Document).all():
        for field in ("name", "original_name", "description"):
            new = fix(getattr(doc, field))
            if new != getattr(doc, field):
                setattr(doc, field, new)
                updated += 1
    for cat in db.query(Category).all():
        for field in ("name", "description"):
            new = fix(getattr(cat, field))
            if new != getattr(cat, field):
                setattr(cat, field, new)
                updated += 1
    for tag in db.query(Tag).all():
        new = fix(tag.name)
        if new != tag.name:
            # merge potential NFC duplicate instead of violating unique
            existing = db.query(Tag).filter(Tag.name == new).first()
            if existing and existing.id != tag.id:
                for doc in db.query(Document).all():
                    if tag in doc.tags:
                        doc.tags.remove(tag)
                        if existing not in doc.tags:
                            doc.tags.append(existing)
                db.delete(tag)
            else:
                tag.name = new
            updated += 1
    db.commit()
    return updated

"""Correspondence domain logic: validation, numbering, search, import."""
from datetime import date
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.database import normalize_text
from app.models.correspondence import (
    CorrespondenceAttachment,
    CorrespondenceDocument,
    CorrespondenceLink,
    CorrespondenceNumberConfig,
    DocumentType,
)
from app.models.document import Document

LEVELS = {"LOW", "MEDIUM", "HIGH"}
STATUSES = {"DRAFT", "APPROVED", "PENDING_SIGNATURE", "ISSUED"}
MAX_IMPORT_ROWS = 500


def format_number(cfg: CorrespondenceNumberConfig) -> str:
    num = str(cfg.current_number + 1).zfill(max(1, cfg.number_length))
    return f"{cfg.prefix or ''}{num}{cfg.suffix or ''}"


def get_or_create_number_config(db: Session, direction: str) -> CorrespondenceNumberConfig:
    cfg = db.query(CorrespondenceNumberConfig).filter(CorrespondenceNumberConfig.direction == direction).first()
    if not cfg:
        cfg = CorrespondenceNumberConfig(direction=direction)
        db.add(cfg)
        db.flush()
    return cfg


def validate_payload(
    db: Session,
    direction: str,
    data: dict,
    exclude_id: str | None = None,
    existing_numbers: set[str] | None = None,
) -> list[str]:
    """Return list of Vietnamese error messages (empty = valid)."""
    errors: list[str] = []
    number = (data.get("document_number") or "").strip()
    if not number:
        errors.append("Số văn bản không được để trống.")
    elif exclude_id is None or True:
        q = db.query(CorrespondenceDocument).filter(
            CorrespondenceDocument.direction == direction,
            CorrespondenceDocument.document_number == number,
        )
        if exclude_id:
            q = q.filter(CorrespondenceDocument.id != exclude_id)
        if q.first():
            errors.append(f"Số văn bản '{number}' đã tồn tại.")
        if existing_numbers is not None and number in existing_numbers:
            errors.append(f"Số văn bản '{number}' bị trùng trong file import.")
    if direction == "OUTGOING" and not (data.get("recipient") or "").strip():
        errors.append("Nơi nhận không được để trống.")
    if direction == "INCOMING" and not (data.get("sender") or "").strip():
        errors.append("Nơi gửi không được để trống.")
    if direction == "INTERNAL" and not (data.get("recipient") or "").strip():
        errors.append("Bộ phận/người nhận không được để trống.")
    if not (data.get("signer") or "").strip():
        errors.append("Vui lòng chọn/nhập người ký.")
    type_id = data.get("document_type_id")
    if not type_id:
        errors.append("Vui lòng chọn loại văn bản.")
    else:
        t = db.query(DocumentType).filter(DocumentType.id == type_id).first()
        if not t:
            errors.append("Loại văn bản không tồn tại.")
        elif t.status != "ACTIVE":
            errors.append(f"Loại văn bản '{t.name}' đã ngừng sử dụng.")
    if not (data.get("issuing_department") or "").strip():
        errors.append("Vui lòng nhập bộ phận phát hành.")
    for field in ("security_level", "urgency_level"):
        if data.get(field) and data[field] not in LEVELS:
            errors.append(f"{field} không hợp lệ.")
    if data.get("processing_status") and data["processing_status"] not in STATUSES:
        errors.append("Tình trạng xử lý không hợp lệ.")
    qty = data.get("quantity")
    if qty is not None and (not isinstance(qty, int) or qty < 0):
        errors.append("Số lượng phải là số nguyên >= 0.")
    eff, exp = data.get("effective_date"), data.get("expiry_date")
    if eff and exp and eff > exp:
        errors.append("Ngày hiệu lực phải trước hoặc bằng ngày hết hiệu lực.")
    for link in data.get("links") or []:
        url = (link.get("url") or "") if isinstance(link, dict) else getattr(link, "url", "")
        if url and not (url.startswith("http://") or url.startswith("https://")):
            errors.append(f"Liên kết '{url}' không phải URL hợp lệ.")
            break
    return errors


def _norm_dates(data: dict) -> dict:
    from datetime import date as _date

    out = dict(data)
    for f in ("signed_date", "effective_date", "expiry_date", "issue_date"):
        v = out.get(f)
        if isinstance(v, str) and v.strip():
            try:
                out[f] = _date.fromisoformat(v.strip()[:10])
            except ValueError:
                out[f] = v  # leave as-is; pydantic/validation reports it
    return out


def create_document(db: Session, direction: str, data: dict, user_id: str) -> CorrespondenceDocument:
    data = _norm_dates(data)
    errors = validate_payload(db, direction, data)
    if errors:
        raise ValueError("; ".join(errors))
    number = data["document_number"].strip()
    doc = CorrespondenceDocument(
        direction=direction,
        document_number=number,
        recipient=(normalize_text((data.get("recipient") or "").strip()) or None),
        sender=(normalize_text((data.get("sender") or "").strip()) or None),
        quantity=data.get("quantity"),
        signer=normalize_text((data.get("signer") or "").strip()),
        security_level=data.get("security_level"),
        urgency_level=data.get("urgency_level"),
        signed_date=data.get("signed_date"),
        effective_date=data.get("effective_date"),
        expiry_date=data.get("expiry_date"),
        issuing_department=normalize_text((data.get("issuing_department") or "").strip()),
        issue_date=data.get("issue_date"),
        document_type_id=data.get("document_type_id"),
        processing_status=data.get("processing_status") or "DRAFT",
        notes=normalize_text(data.get("notes")) if data.get("notes") else None,
        created_by=user_id,
    )
    db.add(doc)
    db.flush()
    attach_documents(db, doc, data.get("attachment_ids") or [])
    replace_links(db, doc, data.get("links") or [])
    # Auto-bump numbering when the used number matches the generated next one.
    cfg = get_or_create_number_config(db, direction)
    if number == format_number(cfg):
        cfg.current_number += 1
    db.commit()
    db.refresh(doc)
    return doc


def attach_documents(db: Session, doc: CorrespondenceDocument, document_ids: list[str]) -> None:
    for did in document_ids or []:
        if not db.query(Document).filter(Document.id == did).first():
            raise ValueError(f"Tệp đính kèm không tồn tại: {did}")
        if not any(a.document_id == did for a in doc.attachments):
            doc.attachments.append(CorrespondenceAttachment(correspondence_id=doc.id, document_id=did))


def replace_links(db: Session, doc: CorrespondenceDocument, links: list) -> None:
    doc.links.clear()
    db.flush()
    for link in links or []:
        name = link.get("name") if isinstance(link, dict) else link.name
        url = link.get("url") if isinstance(link, dict) else link.url
        doc.links.append(CorrespondenceLink(correspondence_id=doc.id, name=(name or url or "").strip()[:255], url=(url or "").strip()))


def apply_corr_filters(query, direction: str, q=None, type_id=None, signer=None,
                       department=None, security=None, urgency=None, status=None,
                       date_from=None, date_to=None):
    from app.models.correspondence import CorrespondenceDocument as CD

    query = query.filter(CD.direction == direction)
    if q:
        like = f"%{normalize_text(q) or q}%"
        query = query.outerjoin(DocumentType, CD.document_type_id == DocumentType.id)
        query = query.filter(or_(
            CD.document_number.ilike(like),
            CD.recipient.ilike(like),
            CD.sender.ilike(like),
            CD.signer.ilike(like),
            CD.notes.ilike(like),
            CD.issuing_department.ilike(like),
            DocumentType.name.ilike(like),
        ))
    if type_id:
        query = query.filter(CD.document_type_id == type_id)
    if signer:
        query = query.filter(CD.signer.ilike(f"%{signer}%"))
    if department:
        query = query.filter(CD.issuing_department.ilike(f"%{department}%"))
    if security:
        query = query.filter(CD.security_level == security)
    if urgency:
        query = query.filter(CD.urgency_level == urgency)
    if status:
        query = query.filter(CD.processing_status == status)
    if date_from:
        query = query.filter(CD.issue_date >= date_from)
    if date_to:
        query = query.filter(CD.issue_date <= date_to)
    return query.distinct()


def import_rows(db: Session, direction: str, rows: list[dict], user_id: str) -> dict:
    """Partial import: valid rows are created, invalid reported. Max 500 rows."""
    if len(rows) > MAX_IMPORT_ROWS:
        raise ValueError(f"File vượt quá {MAX_IMPORT_ROWS} dòng.")
    errors: list[dict] = []
    created = 0
    seen: set[str] = set()
    for idx, raw in enumerate(rows, start=1):
        data = _norm_dates({k: (v.strip() if isinstance(v, str) else v) for k, v in (raw or {}).items()})
        row_errors = validate_payload(db, direction, data, existing_numbers=seen)
        number = (data.get("document_number") or "").strip()
        if row_errors:
            errors.append({"row": idx, "errors": row_errors})
            if number:
                seen.add(number)
            continue
        try:
            create_document(db, direction, data, user_id)
            created += 1
            seen.add(number)
        except ValueError as e:
            errors.append({"row": idx, "errors": [str(e)]})
            if number:
                seen.add(number)
    return {"total": len(rows), "success": created, "failed": len(errors), "errors": errors}

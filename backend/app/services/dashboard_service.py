"""Dashboard statistics: single aggregated query set, no row fetching.

All counts use SQL COUNT/GROUP BY. Trend bucketing and Top-N ranking run over
lightweight (direction, day, status, ...) tuples — never full rows — so the
payload stays small on both SQLite and PostgreSQL without dialect hacks.
Date basis is ``created_at`` (always present; issue_date is nullable).
"""
from collections import Counter
from datetime import date, datetime, timedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.correspondence import CorrespondenceDocument as CD
from app.models.document import Document

DIRECTIONS = ("INCOMING", "OUTGOING", "INTERNAL")
TOP_N = 10
MAX_RANGE_DAYS = 366


def parse_range(from_str: str | None, to_str: str | None) -> tuple[date, date]:
    today = datetime.utcnow().date()
    try:
        to_d = date.fromisoformat(to_str) if to_str else today
    except ValueError:
        to_d = today
    try:
        from_d = date.fromisoformat(from_str) if from_str else to_d - timedelta(days=29)
    except ValueError:
        from_d = to_d - timedelta(days=29)
    if from_d > to_d:
        from_d = to_d
    if (to_d - from_d).days > MAX_RANGE_DAYS:
        from_d = to_d - timedelta(days=MAX_RANGE_DAYS)
    return from_d, to_d


def _bucket(d: date, from_d: date, span: int) -> str:
    if span <= 31:
        return d.isoformat()
    if span <= 120:
        monday = d - timedelta(days=d.weekday())
        return monday.isoformat()
    return f"{d.year}-{d.month:02d}"


def get_stats(db: Session, from_d: date, to_d: date, user=None) -> dict:
    from app.core.permissions import scope_corr_query, scope_document_query

    start = datetime(from_d.year, from_d.month, from_d.day)
    end = datetime(to_d.year, to_d.month, to_d.day) + timedelta(days=1)
    span = (to_d - from_d).days or 1

    doc_q = db.query(Document)
    cd_q = db.query(CD)
    if user is not None:
        doc_q = scope_document_query(doc_q, user)
        cd_q = scope_corr_query(cd_q, user)

    overview = {
        "total_documents": doc_q.with_entities(func.count(Document.id)).scalar() or 0,
        "incoming": 0, "outgoing": 0, "internal": 0,
    }
    for direction, count in (
        cd_q.with_entities(CD.direction, func.count(CD.id)).group_by(CD.direction).all()
    ):
        key = (direction or "").lower()
        if key in overview:
            overview[key] = count

    rows = (
        cd_q.with_entities(
            CD.direction, CD.created_at, CD.processing_status,
            CD.document_type_id, CD.security_level, CD.urgency_level,
            CD.sender, CD.recipient, CD.issuing_department,
        )
        .filter(CD.created_at >= start, CD.created_at < end)
        .all()
    )

    trend: dict[str, dict[str, int]] = {}
    status_c: Counter = Counter()
    security_c: Counter = Counter()
    urgency_c: Counter = Counter()
    type_c: Counter = Counter()
    senders: Counter = Counter()
    recipients: Counter = Counter()
    departments: Counter = Counter()
    for direction, created, status, type_id, sec, urg, sender, recipient, dept in rows:
        day = (created.date() if isinstance(created, datetime) else created) or to_d
        bucket = _bucket(day, from_d, span)
        cell = trend.setdefault(bucket, {"incoming": 0, "outgoing": 0, "internal": 0})
        key = (direction or "").lower()
        if key in cell:
            cell[key] += 1
        if status:
            status_c[status] += 1
        if sec:
            security_c[sec] += 1
        if urg:
            urgency_c[urg] += 1
        if type_id:
            type_c[type_id] += 1
        if sender and sender.strip():
            senders[sender.strip()] += 1
        if recipient and recipient.strip():
            recipients[recipient.strip()] += 1
        if dept and dept.strip():
            departments[dept.strip()] += 1

    # Cảnh báo hết hiệu lực: 0 <= (expiry - hôm nay) <= 10 ngày.
    # Đã quá hạn hoặc không có ngày hết hạn thì không báo. Tôn trọng visibility.
    today = datetime.utcnow().date()
    expiring = (
        cd_q.with_entities(
            CD.id, CD.direction, CD.document_number, CD.expiry_date,
            CD.processing_status, CD.signer,
        )
        .filter(
            CD.expiry_date.isnot(None),
            CD.expiry_date >= today,
            CD.expiry_date <= today + timedelta(days=10),
        )
        .order_by(CD.expiry_date.asc())
        .limit(50)
        .all()
    )
    expiring_soon = [
        {
            "id": cid,
            "direction": direction,
            "document_number": number,
            "expiry_date": exp.isoformat(),
            "days_left": (exp - today).days,
            "processing_status": status,
            "signer": signer,
        }
        for cid, direction, number, exp, status, signer in expiring
    ]

    type_names = {}
    if type_c:
        from app.models.correspondence import DocumentType
        for t in db.query(DocumentType).filter(DocumentType.id.in_(list(type_c))).all():
            type_names[t.id] = {"code": t.code, "name": t.name}

    buckets = sorted(trend)
    return {
        "from": from_d.isoformat(),
        "to": to_d.isoformat(),
        "overview": overview,
        "trend": [
            {"date": b, "incoming": trend[b]["incoming"],
             "outgoing": trend[b]["outgoing"], "internal": trend[b]["internal"]}
            for b in buckets
        ],
        "processing_status": [{"status": s, "count": c} for s, c in status_c.most_common()],
        "document_types": [
            {"id": tid,
             "code": type_names.get(tid, {}).get("code", "?"),
             "name": type_names.get(tid, {}).get("name", "?"),
             "count": c}
            for tid, c in type_c.most_common(10)
        ],
        "security_levels": [{"level": lv, "count": c} for lv, c in security_c.most_common()],
        "urgency_levels": [{"level": lv, "count": c} for lv, c in urgency_c.most_common()],
        "top_senders": [{"name": n, "count": c} for n, c in senders.most_common(TOP_N)],
        "top_recipients": [{"name": n, "count": c} for n, c in recipients.most_common(TOP_N)],
        "top_departments": [{"name": n, "count": c} for n, c in departments.most_common(TOP_N)],
        "expiring_soon": expiring_soon,
    }

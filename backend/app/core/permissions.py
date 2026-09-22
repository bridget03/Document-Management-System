"""Authorization policy: owner/role + sharing scope (visibility + department).

Sharing model (documents + correspondence):
- ORGANIZATION: every authenticated user may read (legacy default — existing
  rows keep this, so nothing is hidden by the migration itself).
- DEPARTMENT: readers in the same department, plus the owner and ADMIN.
- PRIVATE: only the owner and ADMIN.

Edit / delete stay owner-or-ADMIN (unchanged). Types / numbering settings
stay ADMIN-only. A user with no department simply matches no DEPARTMENT row
except their own.
"""

from sqlalchemy import and_, or_

from app.models.user import User

VISIBILITIES = ("ORGANIZATION", "DEPARTMENT", "PRIVATE")


def is_admin(user: User) -> bool:
    return user.role == "ADMIN"


def is_owner(user: User, created_by: str | None) -> bool:
    return bool(created_by) and created_by == user.id


def normalize_visibility(value: str | None) -> str:
    v = (value or "ORGANIZATION").upper()
    return v if v in VISIBILITIES else "ORGANIZATION"


def _scope_filter(visibility_col, department_col, owner_col, user: User):
    """SQLAlchemy filter for list queries. Returns None for ADMIN (no filter)."""
    if is_admin(user):
        return None
    conds = [
        visibility_col == "ORGANIZATION",
        visibility_col.is_(None),
        owner_col == user.id,
    ]
    if getattr(user, "department", None):
        conds.append(
            and_(visibility_col == "DEPARTMENT", department_col == user.department)
        )
    return or_(*conds)


def scope_document_query(query, user: User):
    from app.models.document import Document

    f = _scope_filter(Document.visibility, Document.department, Document.uploaded_by, user)
    return query if f is None else query.filter(f)


def scope_corr_query(query, user: User):
    from app.models.correspondence import CorrespondenceDocument as CD

    f = _scope_filter(CD.visibility, CD.department, CD.created_by, user)
    return query if f is None else query.filter(f)


def _can_view(visibility: str | None, department: str | None, owner_id: str | None, user: User) -> bool:
    if is_admin(user) or is_owner(user, owner_id):
        return True
    v = normalize_visibility(visibility)
    if v == "ORGANIZATION":
        return True
    if v == "DEPARTMENT":
        return bool(getattr(user, "department", None)) and user.department == department
    return False  # PRIVATE


def can_view_document(user: User, doc) -> bool:
    return _can_view(doc.visibility, doc.department, doc.uploaded_by, user)


def can_view_corr(user: User, doc=None) -> bool:
    if doc is None:
        return True
    return _can_view(doc.visibility, doc.department, doc.created_by, user)


def can_create_corr(user: User, direction: str) -> bool:
    """Every authenticated user may create in any direction."""
    return True


def can_edit_corr(user: User, doc) -> bool:
    """Owner or ADMIN. No department scoping on write."""
    return is_admin(user) or is_owner(user, doc.created_by)


def can_delete_corr(user: User, doc) -> bool:
    """Same rule as edit (owner or ADMIN)."""
    return can_edit_corr(user, doc)


def can_manage_corr_config(user: User) -> bool:
    """Document types + numbering settings: ADMIN only."""
    return is_admin(user)

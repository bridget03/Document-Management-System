"""Correspondence authorization policy — PHASE scope: existing auth only.

Current rules (mirrors the Documents module):
- Read / create / import: any authenticated, active user.
  No document-level or department-level scoping is applied in this phase,
  including for INTERNAL direction.
- Edit / delete: record owner or ADMIN.
- Document types / numbering settings: ADMIN only.

EXTENSION POINTS (deliberately not implemented yet):
- :func:`can_view_corr` — future home of document-level access control
  (e.g. per-record ACL). All read paths already funnel through it, so a
  future rule only needs to change this one function (plus list-query
  filtering in the service layer).
- Department-level control will additionally need a department master +
  membership model; natural anchors already exist on the record
  (``issuing_department`` text, ``created_by`` FK). Do NOT bolt ad-hoc
  department checks onto these helpers — introduce that model first.
"""

from app.models.user import User


def is_admin(user: User) -> bool:
    return user.role == "ADMIN"


def is_owner(user: User, created_by: str | None) -> bool:
    return bool(created_by) and created_by == user.id


def can_view_corr(user: User, doc=None) -> bool:
    """Phase: every authenticated user may read every record."""
    return True


def can_create_corr(user: User, direction: str) -> bool:
    """Phase: every authenticated user may create in any direction."""
    return True


def can_edit_corr(user: User, doc) -> bool:
    """Phase: owner or ADMIN. No department scoping."""
    return is_admin(user) or is_owner(user, doc.created_by)


def can_delete_corr(user: User, doc) -> bool:
    """Phase: same rule as edit (owner or ADMIN)."""
    return can_edit_corr(user, doc)


def can_manage_corr_config(user: User) -> bool:
    """Document types + numbering settings: ADMIN only."""
    return is_admin(user)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.services.dashboard_service import get_stats, parse_range

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(
    from_date: str | None = None,
    to_date: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Aggregated dashboard statistics (single request, no row fetching).

    Dates are ``YYYY-MM-DD``; defaults to the last 30 days, clamped to 366.
    Respects existing auth; no document-level permission model exists yet.
    """
    try:
        from_d, to_d = parse_range(from_date, to_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return get_stats(db, from_d, to_d)

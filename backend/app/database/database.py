import unicodedata

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def normalize_text(value: str | None) -> str | None:
    """NFC-normalize user text so composed (NFC) queries match decomposed (NFD)
    stored values, e.g. Google Drive / macOS filenames. Returns input unchanged
    when empty/None."""
    if not value:
        return value
    return unicodedata.normalize("NFC", value)


if settings.DATABASE_URL.startswith("sqlite"):
    # SQLite's builtin lower()/upper() only fold ASCII, which breaks
    # case-insensitive (ilike) search for Vietnamese text. Override them per
    # connection with Python's full-Unicode versions. PostgreSQL is unaffected
    # (its lower() is already Unicode-aware).
    @event.listens_for(engine, "connect")
    def _register_unicode_case(dbapi_conn, _record):
        dbapi_conn.create_function(
            "lower", 1, lambda s: s.lower() if isinstance(s, str) else s
        )
        dbapi_conn.create_function(
            "upper", 1, lambda s: s.upper() if isinstance(s, str) else s
        )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

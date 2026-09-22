"""Encrypt Google OAuth tokens at rest (Fernet, key from DRIVE_TOKEN_KEY).

Stored format is "enc:<fernet>" so reads can distinguish legacy plaintext
rows (decrypt skipped) from encrypted ones. When no key is configured,
production fails fast while dev/test pass tokens through with a warning.
"""
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

PREFIX = "enc:"


def _fernet():
    from cryptography.fernet import Fernet

    key = (settings.DRIVE_TOKEN_KEY or "").strip()
    if not key:
        if settings.APP_ENV == "production":
            raise RuntimeError("DRIVE_TOKEN_KEY is required in production")
        logger.warning("DRIVE_TOKEN_KEY not set — Drive tokens stored in plaintext (dev only)")
        return None
    try:
        return Fernet(key.encode())
    except Exception as e:
        raise RuntimeError(f"Invalid DRIVE_TOKEN_KEY: {e}")


def protect_token(plain: str | None) -> str | None:
    """Encrypt before writing to google_drive_configs. Idempotent."""
    if not plain:
        return plain
    if plain.startswith(PREFIX):
        return plain
    f = _fernet()
    if f is None:
        return plain
    return PREFIX + f.encrypt(plain.encode()).decode()


def reveal_token(stored: str | None) -> str | None:
    """Decrypt for Google API use. Legacy plaintext passes through."""
    if not stored:
        return stored
    if not stored.startswith(PREFIX):
        return stored
    f = _fernet()
    if f is None:
        # No key in dev: cannot decrypt rows written with a key.
        raise RuntimeError("DRIVE_TOKEN_KEY is required to read encrypted Drive tokens")
    from cryptography.fernet import InvalidToken

    try:
        return f.decrypt(stored[len(PREFIX):].encode()).decode()
    except InvalidToken:
        raise RuntimeError("Cannot decrypt Drive token — wrong DRIVE_TOKEN_KEY?")

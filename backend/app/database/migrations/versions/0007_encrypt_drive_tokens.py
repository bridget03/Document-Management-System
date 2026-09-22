"""Encrypt existing Google OAuth tokens in place (data migration).

No schema change. If DRIVE_TOKEN_KEY is not configured, this is a no-op
(runtime still reads legacy plaintext). Idempotent: rows already starting
with "enc:" are skipped.

Revision ID: 0007_encrypt_drive_tokens
Revises: 0006_audit_created_idx
"""
import logging

from alembic import op
import sqlalchemy as sa

revision = "0007_encrypt_drive_tokens"
down_revision = "0006_audit_created_idx"

logger = logging.getLogger(__name__)


def upgrade():
    from app.services.token_crypto import PREFIX, protect_token

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, access_token, refresh_token FROM google_drive_configs")
    ).fetchall()
    done = 0
    for row_id, access, refresh in rows:
        updates = {}
        for col, val in (("access_token", access), ("refresh_token", refresh)):
            if val and not val.startswith(PREFIX):
                enc = protect_token(val)
                # No key configured -> protect_token passes through; skip write.
                if enc != val:
                    updates[col] = enc
        if updates:
            sets = ", ".join(f"{c} = :{c}" for c in updates)
            updates["row_id"] = row_id
            conn.execute(sa.text(f"UPDATE google_drive_configs SET {sets} WHERE id = :row_id"), updates)
            done += 1
    logger.info("Encrypted Drive tokens for %d config row(s)", done)


def downgrade():
    # Decrypting in a downgrade would need the key and risks data loss;
    # runtime reads both formats, so downgrade is a deliberate no-op.
    pass

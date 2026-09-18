"""Seed INTERNAL numbering config. No schema change (direction is free string)."""
revision = "0004_internal_numbering"
down_revision = "0003_correspondence"

import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa


def upgrade():
    now = datetime.utcnow()
    op.execute(
        sa.text(
            "INSERT INTO correspondence_number_configs "
            "(id, direction, current_number, number_length, prefix, suffix, created_at, updated_at) "
            "SELECT :id, 'INTERNAL', 0, 3, '', '', :now, :now "
            "WHERE NOT EXISTS (SELECT 1 FROM correspondence_number_configs WHERE direction = 'INTERNAL')"
        ).bindparams(id=str(uuid.uuid4()), now=now)
    )


def downgrade():
    op.execute(
        sa.text("DELETE FROM correspondence_number_configs WHERE direction = 'INTERNAL'")
    )

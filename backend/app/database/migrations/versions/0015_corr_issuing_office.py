"""Outgoing correspondence: issuing office (Phong ban phat hanh).

Revision ID: 0015_corr_issuing_office
Revises: 0014_receiving_units
"""
import sqlalchemy as sa
from alembic import op

revision = "0015_corr_issuing_office"
down_revision = "0014_receiving_units"


def upgrade():
    op.add_column(
        "correspondence_documents",
        sa.Column("issuing_office", sa.String(255), nullable=True),
    )


def downgrade():
    op.drop_column("correspondence_documents", "issuing_office")

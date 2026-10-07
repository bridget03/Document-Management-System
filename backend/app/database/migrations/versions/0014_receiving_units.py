"""Catalog of receiving units (dropdown "Don vi tiep nhan" for incoming docs).

Revision ID: 0014_receiving_units
Revises: 0013_corr_title_received
"""
import sqlalchemy as sa
from alembic import op

revision = "0014_receiving_units"
down_revision = "0013_corr_title_received"


def upgrade():
    op.create_table(
        "receiving_units",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_receiving_units_name", "receiving_units", ["name"], unique=True)


def downgrade():
    op.drop_index("ix_receiving_units_name", table_name="receiving_units")
    op.drop_table("receiving_units")

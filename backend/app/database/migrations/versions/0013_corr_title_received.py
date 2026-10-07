"""Incoming correspondence: title + received date.

Revision ID: 0013_corr_title_received
Revises: 0012_corr_is_important
"""
import sqlalchemy as sa
from alembic import op

revision = "0013_corr_title_received"
down_revision = "0012_corr_is_important"


def upgrade():
    op.add_column(
        "correspondence_documents",
        sa.Column("title", sa.String(500), nullable=True),
    )
    op.add_column(
        "correspondence_documents",
        sa.Column("received_date", sa.Date(), nullable=True),
    )


def downgrade():
    op.drop_column("correspondence_documents", "received_date")
    op.drop_column("correspondence_documents", "title")

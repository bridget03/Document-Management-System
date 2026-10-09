"""Internal correspondence: topic (Van de).

Revision ID: 0017_corr_topic
Revises: 0016_document_origin
"""
import sqlalchemy as sa
from alembic import op

revision = "0017_corr_topic"
down_revision = "0016_document_origin"


def upgrade():
    op.add_column(
        "correspondence_documents",
        sa.Column("topic", sa.String(500), nullable=True),
    )


def downgrade():
    op.drop_column("correspondence_documents", "topic")

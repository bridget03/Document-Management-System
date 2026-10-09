"""Catalog of topics (dropdown "Van de" for internal docs).

Revision ID: 0018_topics
Revises: 0017_corr_topic
"""
import sqlalchemy as sa
from alembic import op

revision = "0018_topics"
down_revision = "0017_corr_topic"


def upgrade():
    op.create_table(
        "topics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_topics_name", "topics", ["name"], unique=True)


def downgrade():
    op.drop_index("ix_topics_name", table_name="topics")
    op.drop_table("topics")

"""Mark important correspondence (red tag in lists).

Revision ID: 0012_corr_is_important
Revises: 0011_folder_parent
"""
import sqlalchemy as sa
from alembic import op

revision = "0012_corr_is_important"
down_revision = "0011_folder_parent"


def upgrade():
    op.add_column(
        "correspondence_documents",
        sa.Column("is_important", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        "ix_correspondence_documents_is_important",
        "correspondence_documents",
        ["is_important"],
    )


def downgrade():
    op.drop_index("ix_correspondence_documents_is_important", table_name="correspondence_documents")
    op.drop_column("correspondence_documents", "is_important")

"""User-managed correspondence folders.

Revision ID: 0010_correspondence_folders
Revises: 0009_departments
"""
import sqlalchemy as sa
from alembic import op

revision = "0010_correspondence_folders"
down_revision = "0009_departments"


def upgrade():
    op.create_table(
        "correspondence_folders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_correspondence_folders_direction", "correspondence_folders", ["direction"])
    op.create_index("ix_correspondence_folders_owner_id", "correspondence_folders", ["owner_id"])
    op.create_table(
        "correspondence_folder_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("folder_id", sa.String(36), sa.ForeignKey("correspondence_folders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("correspondence_id", sa.String(36), sa.ForeignKey("correspondence_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("owner_id", "correspondence_id", name="uq_corr_folder_item_owner_document"),
    )
    op.create_index("ix_correspondence_folder_items_folder_id", "correspondence_folder_items", ["folder_id"])
    op.create_index("ix_correspondence_folder_items_correspondence_id", "correspondence_folder_items", ["correspondence_id"])
    op.create_index("ix_correspondence_folder_items_owner_id", "correspondence_folder_items", ["owner_id"])


def downgrade():
    op.drop_table("correspondence_folder_items")
    op.drop_table("correspondence_folders")

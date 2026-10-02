"""Allow nested correspondence folders.

Revision ID: 0011_folder_parent
Revises: 0010_correspondence_folders
"""
import sqlalchemy as sa
from alembic import op

revision = "0011_folder_parent"
down_revision = "0010_correspondence_folders"


def upgrade():
    with op.batch_alter_table("correspondence_folders") as batch_op:
        batch_op.add_column(sa.Column("parent_id", sa.String(36), nullable=True))
        batch_op.create_foreign_key(
            "fk_correspondence_folders_parent_id",
            "correspondence_folders",
            ["parent_id"], ["id"], ondelete="CASCADE",
        )
        batch_op.create_index("ix_correspondence_folders_parent_id", ["parent_id"])


def downgrade():
    with op.batch_alter_table("correspondence_folders") as batch_op:
        batch_op.drop_index("ix_correspondence_folders_parent_id")
        batch_op.drop_constraint("fk_correspondence_folders_parent_id", type_="foreignkey")
        batch_op.drop_column("parent_id")

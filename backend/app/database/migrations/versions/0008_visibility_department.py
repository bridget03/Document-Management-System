"""Sharing scope: visibility + department on users/documents/correspondence.

Existing rows keep ORGANIZATION semantics (default), so the migration hides
nothing by itself.

Revision ID: 0008_visibility_department
Revises: 0007_encrypt_drive_tokens
"""
import sqlalchemy as sa
from alembic import op

revision = "0008_visibility_department"
down_revision = "0007_encrypt_drive_tokens"


def upgrade():
    op.add_column("users", sa.Column("department", sa.String(255), nullable=True))
    op.create_index("ix_users_department", "users", ["department"])
    for table in ("documents", "correspondence_documents"):
        op.add_column(
            table,
            sa.Column("visibility", sa.String(20), nullable=False, server_default="ORGANIZATION"),
        )
        op.add_column(table, sa.Column("department", sa.String(255), nullable=True))
        op.create_index(f"ix_{table}_department", table, ["department"])


def downgrade():
    for table in ("documents", "correspondence_documents"):
        op.drop_index(f"ix_{table}_department", table_name=table)
        op.drop_column(table, "department")
        op.drop_column(table, "visibility")
    op.drop_index("ix_users_department", table_name="users")
    op.drop_column("users", "department")

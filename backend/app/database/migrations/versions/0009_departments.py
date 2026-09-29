"""Danh mục phòng ban dùng chung (chia sẻ công văn/tài liệu, gán phòng cho user).

Revision ID: 0009_departments
Revises: 0008_visibility_department
"""
import sqlalchemy as sa
from alembic import op

revision = "0009_departments"
down_revision = "0008_visibility_department"


def upgrade():
    op.create_table(
        "departments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_departments_name", "departments", ["name"])
    op.create_index("ix_departments_status", "departments", ["status"])


def downgrade():
    op.drop_index("ix_departments_status", table_name="departments")
    op.drop_index("ix_departments_name", table_name="departments")
    op.drop_table("departments")

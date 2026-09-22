"""Index audit_logs.created_at for the audit viewer range queries.

Revision ID: 0006_audit_created_idx
Revises: 0005_repair_constraints
"""
from alembic import op

revision = "0006_audit_created_idx"
down_revision = "0005_repair_constraints"


def upgrade():
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])


def downgrade():
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")

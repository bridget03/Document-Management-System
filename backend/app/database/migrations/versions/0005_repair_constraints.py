"""Repair missing FK constraints + indexes (model declares them, 0001 did not create them).

Revision ID: 0005_repair_constraints
Revises: 0004_internal_numbering
"""
from alembic import op

revision = "0005_repair_constraints"
down_revision = "0004_internal_numbering"


def upgrade():
    # FKs declared in models but missing in DB (orphan check passed: 0 rows).
    op.create_foreign_key(
        "documents_category_id_fkey", "documents", "categories",
        ["category_id"], ["id"],
    )
    op.create_foreign_key(
        "documents_uploaded_by_fkey", "documents", "users",
        ["uploaded_by"], ["id"],
    )
    # Indexes declared with index=True in models but missing in DB.
    op.create_index("ix_documents_file_extension", "documents", ["file_extension"])
    op.create_index("ix_documents_category_id", "documents", ["category_id"])
    op.create_index("ix_documents_uploaded_by", "documents", ["uploaded_by"])
    op.create_index("ix_documents_created_at", "documents", ["created_at"])
    op.create_index("ix_audit_logs_user_id", "audit_logs", ["user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_document_id", "audit_logs", ["document_id"])


def downgrade():
    op.drop_index("ix_audit_logs_document_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs")
    op.drop_index("ix_documents_created_at", table_name="documents")
    op.drop_index("ix_documents_uploaded_by", table_name="documents")
    op.drop_index("ix_documents_category_id", table_name="documents")
    op.drop_index("ix_documents_file_extension", table_name="documents")
    op.drop_constraint("documents_uploaded_by_fkey", "documents", type_="foreignkey")
    op.drop_constraint("documents_category_id_fkey", "documents", type_="foreignkey")

"""Distinguish internal library files from correspondence attachments.

Revision ID: 0016_document_origin
Revises: 0015_corr_issuing_office
"""
import sqlalchemy as sa
from alembic import op

revision = "0016_document_origin"
down_revision = "0015_corr_issuing_office"


def upgrade():
    op.add_column(
        "documents",
        sa.Column("origin", sa.String(20), nullable=False, server_default="LIBRARY"),
    )
    op.create_index("ix_documents_origin", "documents", ["origin"])
    # File cu dang duoc cong van nao dinh kem -> danh dau CORRESPONDENCE
    # de an khoi danh sach Tai lieu (kho vat ly van dung chung).
    op.execute(
        "UPDATE documents SET origin = 'CORRESPONDENCE' WHERE id IN "
        "(SELECT document_id FROM correspondence_attachments)"
    )


def downgrade():
    op.drop_index("ix_documents_origin", table_name="documents")
    op.drop_column("documents", "origin")

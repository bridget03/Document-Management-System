"""Correspondence module: types, numbering, documents, attachments, links."""
revision = "0003_correspondence"
down_revision = "0002_sync_files"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "document_types",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("status", sa.String(20), nullable=False, server_default="ACTIVE"),
        sa.Column("default_signer", sa.String(255)),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "correspondence_number_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("direction", sa.String(20), nullable=False, unique=True),
        sa.Column("current_number", sa.Integer, nullable=False, server_default="0"),
        sa.Column("number_length", sa.Integer, nullable=False, server_default="3"),
        sa.Column("prefix", sa.String(50), server_default=""),
        sa.Column("suffix", sa.String(100), server_default=""),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "correspondence_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("direction", sa.String(20), nullable=False),
        sa.Column("document_number", sa.String(255), nullable=False),
        sa.Column("recipient", sa.String(500)),
        sa.Column("sender", sa.String(500)),
        sa.Column("quantity", sa.Integer),
        sa.Column("signer", sa.String(255)),
        sa.Column("security_level", sa.String(20)),
        sa.Column("urgency_level", sa.String(20)),
        sa.Column("signed_date", sa.Date),
        sa.Column("effective_date", sa.Date),
        sa.Column("expiry_date", sa.Date),
        sa.Column("issuing_department", sa.String(255)),
        sa.Column("issue_date", sa.Date),
        sa.Column("document_type_id", sa.String(36), sa.ForeignKey("document_types.id")),
        sa.Column("processing_status", sa.String(30), nullable=False, server_default="DRAFT"),
        sa.Column("notes", sa.Text),
        sa.Column("created_by", sa.String(36), sa.ForeignKey("users.id")),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("direction", "document_number", name="uq_corr_direction_number"),
    )
    for col in ["direction", "document_number", "issuing_department", "issue_date",
                "document_type_id", "processing_status", "created_at"]:
        op.create_index(f"ix_corr_docs_{col}", "correspondence_documents", [col])
    op.create_table(
        "correspondence_attachments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("correspondence_id", sa.String(36), sa.ForeignKey("correspondence_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_corr_att_corr", "correspondence_attachments", ["correspondence_id"])
    op.create_table(
        "correspondence_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("correspondence_id", sa.String(36), sa.ForeignKey("correspondence_documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_corr_links_corr", "correspondence_links", ["correspondence_id"])
    op.add_column("audit_logs", sa.Column("correspondence_id", sa.String(36), nullable=True))
    op.create_index("ix_audit_corr", "audit_logs", ["correspondence_id"])


def downgrade():
    op.drop_index("ix_audit_corr", table_name="audit_logs")
    op.drop_column("audit_logs", "correspondence_id")
    op.drop_table("correspondence_links")
    op.drop_table("correspondence_attachments")
    for col in ["direction", "document_number", "issuing_department", "issue_date",
                "document_type_id", "processing_status", "created_at"]:
        op.drop_index(f"ix_corr_docs_{col}", table_name="correspondence_documents")
    op.drop_table("correspondence_documents")
    op.drop_table("correspondence_number_configs")
    op.drop_table("document_types")

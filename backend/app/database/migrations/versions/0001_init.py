"""Initial tables"""
revision = "0001_init"
down_revision = None

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="USER"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "tags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("original_name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("mime_type", sa.String(255)),
        sa.Column("file_extension", sa.String(50)),
        sa.Column("file_size", sa.BigInteger),
        sa.Column("storage_type", sa.String(50), nullable=False, server_default="LOCAL"),
        sa.Column("local_file_path", sa.Text),
        sa.Column("google_drive_file_id", sa.String(255), unique=True),
        sa.Column("google_drive_url", sa.Text),
        sa.Column("google_drive_parent_id", sa.String(255)),
        sa.Column("category_id", sa.String(36)),
        sa.Column("uploaded_by", sa.String(36)),
        sa.Column("source", sa.String(50), nullable=False, server_default="LOCAL_UPLOAD"),
        sa.Column("sync_status", sa.String(50), nullable=False, server_default="NOT_SYNCED"),
        sa.Column("google_drive_modified_at", sa.DateTime),
        sa.Column("last_synced_at", sa.DateTime),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "document_tags",
        sa.Column("document_id", sa.String(36), sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", sa.String(36), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "google_drive_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("drive_id", sa.String(255)),
        sa.Column("folder_id", sa.String(255)),
        sa.Column("folder_name", sa.String(500)),
        sa.Column("access_token", sa.Text),
        sa.Column("refresh_token", sa.Text),
        sa.Column("token_expires_at", sa.DateTime),
        sa.Column("connected_email", sa.String(255)),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("config_id", sa.String(36)),
        sa.Column("started_at", sa.DateTime, nullable=False),
        sa.Column("completed_at", sa.DateTime),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("total_files", sa.Integer, server_default="0"),
        sa.Column("created_files", sa.Integer, server_default="0"),
        sa.Column("updated_files", sa.Integer, server_default="0"),
        sa.Column("deleted_files", sa.Integer, server_default="0"),
        sa.Column("failed_files", sa.Integer, server_default="0"),
        sa.Column("error_message", sa.Text),
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36)),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("document_id", sa.String(36)),
        sa.Column("ip_address", sa.String(100)),
        sa.Column("user_agent", sa.Text),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )


def downgrade():
    for t in ["audit_logs", "sync_logs", "google_drive_configs", "document_tags", "documents", "tags", "categories", "users"]:
        op.drop_table(t)

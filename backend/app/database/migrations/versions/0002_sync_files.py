"""File-selection sync scope: sync_scope on configs + google_drive_sync_files table."""
revision = "0002_sync_files"
down_revision = "0001_init"

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column("google_drive_configs", sa.Column("sync_scope", sa.String(20), nullable=False, server_default="FOLDER"))
    op.create_table(
        "google_drive_sync_files",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("config_id", sa.String(36), sa.ForeignKey("google_drive_configs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("google_drive_file_id", sa.String(255), nullable=False),
        sa.Column("file_name", sa.String(500)),
        sa.Column("mime_type", sa.String(255)),
        sa.Column("google_drive_parent_id", sa.String(255)),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint("config_id", "google_drive_file_id", name="uq_sync_file"),
    )
    op.create_index("ix_sync_files_config", "google_drive_sync_files", ["config_id"])
    op.create_index("ix_sync_files_drive_id", "google_drive_sync_files", ["google_drive_file_id"])


def downgrade():
    op.drop_index("ix_sync_files_drive_id", table_name="google_drive_sync_files")
    op.drop_index("ix_sync_files_config", table_name="google_drive_sync_files")
    op.drop_table("google_drive_sync_files")
    op.drop_column("google_drive_configs", "sync_scope")

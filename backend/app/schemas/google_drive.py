from datetime import datetime
from pydantic import BaseModel


class DriveStatus(BaseModel):
    connected: bool
    email: str | None = None
    folder_id: str | None = None
    folder_name: str | None = None
    sync_scope: str = "FOLDER"
    selected_count: int = 0
    last_sync: datetime | None = None


class DriveConfigRequest(BaseModel):
    folder_id: str | None = None
    folder_name: str | None = None
    drive_id: str | None = None
    sync_scope: str | None = None


class SyncFileIn(BaseModel):
    file_id: str
    file_name: str | None = None
    mime_type: str | None = None
    parent_id: str | None = None


class SyncFilesRequest(BaseModel):
    files: list[SyncFileIn] = []


class SyncFileOut(BaseModel):
    id: str
    google_drive_file_id: str
    file_name: str | None = None
    mime_type: str | None = None
    google_drive_parent_id: str | None = None

    class Config:
        from_attributes = True


class SyncLogOut(BaseModel):
    id: str
    started_at: datetime
    completed_at: datetime | None = None
    status: str
    total_files: int = 0
    created_files: int = 0
    updated_files: int = 0
    deleted_files: int = 0
    failed_files: int = 0
    error_message: str | None = None

    class Config:
        from_attributes = True

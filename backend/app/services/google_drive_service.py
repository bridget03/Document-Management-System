from app.core.config import settings


def get_oauth_flow():
    from google_auth_oauthlib.flow import Flow

    return Flow.from_client_config(
        {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [settings.GOOGLE_REDIRECT_URI],
            }
        },
        scopes=[settings.GOOGLE_SCOPES],
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        # Server-side web app uses client_secret; disable PKCE so the
        # code_verifier does not need to survive across /auth -> /callback.
        autogenerate_code_verifier=False,
    )


def build_drive_service(access_token: str, refresh_token: str, expires_at=None):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=[settings.GOOGLE_SCOPES],
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def list_files_in_folder(service, folder_id: str, page_size: int = 100):
    """Return list of files with id, name, mimeType, modifiedTime, webViewLink, size."""
    files: list[dict] = []
    page_token = None
    while True:
        resp = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed=false",
                fields="nextPageToken, files(id,name,mimeType,modifiedTime,webViewLink,size,parents)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                pageSize=page_size,
                pageToken=page_token,
            )
            .execute()
        )
        files.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return files


#: Google Workspace native types cannot be downloaded as binary.
NATIVE_MIMES = {
    "application/vnd.google-apps.document",
    "application/vnd.google-apps.spreadsheet",
    "application/vnd.google-apps.presentation",
    "application/vnd.google-apps.drawing",
    "application/vnd.google-apps.form",
}

#: Native types previewable by exporting (Google Forms cannot be exported).
NATIVE_EXPORT_MIMES = {
    "application/vnd.google-apps.document": "application/pdf",
    "application/vnd.google-apps.spreadsheet": "application/pdf",
    "application/vnd.google-apps.presentation": "application/pdf",
    "application/vnd.google-apps.drawing": "application/pdf",
}

FOLDER_MIME = "application/vnd.google-apps.folder"


class DriveFileNotFound(Exception):
    """A selected Drive file no longer exists or is no longer accessible."""


def browse_items(service, parent_id: str | None = None, page_size: int = 100) -> dict:
    """List one Drive level split into folders and files (no recursion)."""
    parent = parent_id or "root"
    out: dict = {"folders": [], "files": []}
    page_token = None
    while True:
        resp = (
            service.files()
            .list(
                q=f"'{parent}' in parents and trashed=false",
                fields="nextPageToken, files(id,name,mimeType,modifiedTime,size,parents,webViewLink)",
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
                orderBy="folder,name",
                pageSize=page_size,
                pageToken=page_token,
            )
            .execute()
        )
        for f in resp.get("files", []):
            (out["folders"] if f.get("mimeType") == FOLDER_MIME else out["files"]).append(f)
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return out


def get_file_metadata(service, file_id: str) -> dict:
    """Fetch one file's metadata for FILES-scope sync. Raises DriveFileNotFound."""
    from googleapiclient.errors import HttpError

    try:
        return (
            service.files()
            .get(
                fileId=file_id,
                fields="id,name,mimeType,modifiedTime,webViewLink,size,parents",
                supportsAllDrives=True,
            )
            .execute()
        )
    except HttpError as e:
        if getattr(e, "status_code", None) == 404 or "404" in str(e):
            raise DriveFileNotFound(f"Drive file {file_id} no longer exists")
        raise RuntimeError(f"Drive API error: {e}")


def get_drive_file_bytes(db, config, file_id: str) -> tuple[bytes, str, str]:
    """Download a Drive file's bytes for preview streaming.

    Refreshes the OAuth token when expired and persists it. Never exposes
    tokens outside the backend. Raises ValueError for native Google Docs
    editors (preview via Drive URL instead) and RuntimeError when the file
    is gone/inaccessible.
    """
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    import io as _io

    creds = Credentials(
        token=config.access_token,
        refresh_token=config.refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=[settings.GOOGLE_SCOPES],
    )
    if not creds.valid:
        if not creds.refresh_token:
            raise RuntimeError("Google Drive not connected")
        creds.refresh(Request())
        config.access_token = creds.token
        if creds.expiry:
            config.token_expires_at = creds.expiry.replace(tzinfo=None)
        db.commit()

    service = build("drive", "v3", credentials=creds, cache_discovery=False)
    try:
        meta = service.files().get(fileId=file_id, fields="mimeType,name,size", supportsAllDrives=True).execute()
    except Exception as e:
        raise RuntimeError(f"Cannot access file on Google Drive: {e}")
    mime = meta.get("mimeType") or "application/octet-stream"
    buf = _io.BytesIO()
    try:
        if mime in NATIVE_MIMES:
            # Google Docs/Sheets/Slides have no binary: export to PDF for preview.
            export_mime = NATIVE_EXPORT_MIMES.get(mime)
            if not export_mime:
                raise ValueError(f"Native Google file ({mime}) cannot be previewed. Open in Google Drive instead.")
            request = service.files().export_media(fileId=file_id, mimeType=export_mime)
            downloader = MediaIoBaseDownload(buf, request)
            done = False
            while not done:
                _, done = downloader.next_chunk()
            return buf.getvalue(), export_mime, meta.get("name") or "file"
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
    except ValueError:
        raise
    except Exception as e:
        raise RuntimeError(f"Failed to download file from Google Drive: {e}")
    return buf.getvalue(), mime, meta.get("name") or "file"

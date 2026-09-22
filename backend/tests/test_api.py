import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("STORAGE_PATH", "./test_storage")

from fastapi.testclient import TestClient
from app.main import create_app
from app.database.database import Base, engine, SessionLocal
from app.models.user import User
from app.core.security import hash_password


def get_client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.add(User(name="Admin", email="admin@test.com", password_hash=hash_password("admin123"), role="ADMIN"))
    db.commit()
    db.close()
    return TestClient(create_app())


def auth_header(client):
    r = client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_login_upload_search_download_delete():
    client = get_client()
    h = auth_header(client)
    # upload
    r = client.post(
        "/api/documents/upload",
        headers=h,
        files={"file": ("hello.txt", b"hello world", "text/plain")},
        data={"name": "hello.txt"},
    )
    assert r.status_code == 200, r.text
    doc_id = r.json()["id"]
    # search
    r = client.get("/api/documents", headers=h, params={"q": "hello"})
    assert r.status_code == 200 and r.json()["total"] >= 1
    # preview txt
    r = client.get(f"/api/documents/{doc_id}/preview", headers=h)
    assert r.status_code == 200
    # download
    r = client.get(f"/api/documents/{doc_id}/download", headers=h)
    assert r.status_code == 200 and r.content == b"hello world"
    # update
    r = client.put(f"/api/documents/{doc_id}", headers=h, json={"description": "updated"})
    assert r.status_code == 200
    # delete
    r = client.delete(f"/api/documents/{doc_id}", headers=h)
    assert r.status_code == 200


def test_sync_logic():
    from app.models.google_drive import GoogleDriveConfig
    from app.services.sync_service import run_sync
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    cfg = GoogleDriveConfig(folder_id="f1", folder_name="Docs", is_active=True)
    db.add(cfg)
    db.commit()
    files = [{"id": "g1", "name": "ABC.pdf", "mimeType": "application/pdf", "modifiedTime": "2026-09-16T10:00:00Z", "webViewLink": "https://drive/x", "parents": ["f1"]}]
    log = run_sync(db, cfg, files)
    assert log.created_files == 1
    log2 = run_sync(db, cfg, files)
    assert log2.created_files == 0
    db.close()


def _upload(client, h, filename, content, ctype):
    r = client.post(
        "/api/documents/upload",
        headers=h,
        files={"file": (filename, content, ctype)},
        data={"name": filename},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def test_preview_inline_and_security():
    client = get_client()
    h = auth_header(client)
    # unauthenticated -> 401
    assert client.get("/api/documents/xxx/preview").status_code == 401
    # not found -> 404
    assert client.get("/api/documents/00000000-0000-0000-0000-000000000000/preview", headers=h).status_code == 404
    # txt served inline
    txt_id = _upload(client, h, "note.txt", "dòng tiếng Việt\nline2".encode(), "text/plain")
    r = client.get(f"/api/documents/{txt_id}/preview", headers=h)
    assert r.status_code == 200
    assert r.headers["content-disposition"].startswith("inline")
    assert "text/plain" in r.headers["content-type"]
    # minimal pdf served inline with pdf content-type
    pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
    pdf_id = _upload(client, h, "a.pdf", pdf, "application/pdf")
    r = client.get(f"/api/documents/{pdf_id}/preview", headers=h)
    assert r.status_code == 200
    assert r.headers["content-disposition"].startswith("inline")
    assert "application/pdf" in r.headers["content-type"]
    # csv served raw inline (client parses)
    csv_id = _upload(client, h, "d.csv", "a,b\n1,2\n".encode(), "text/csv")
    r = client.get(f"/api/documents/{csv_id}/preview", headers=h)
    assert r.status_code == 200 and r.headers["content-disposition"].startswith("inline")
    # zip -> unsupported JSON, still downloadable
    zip_id = _upload(client, h, "a.zip", b"PK\x03\x04fake", "application/zip")
    r = client.get(f"/api/documents/{zip_id}/preview", headers=h)
    assert r.status_code == 200 and r.json()["preview"] == "unavailable"
    assert client.get(f"/api/documents/{zip_id}/download", headers=h).status_code == 200


def test_preview_drive_only_without_connection():
    from app.models.document import Document
    client = get_client()
    h = auth_header(client)
    db = SessionLocal()
    db.add(Document(name="g.pdf", original_name="g.pdf", mime_type="application/pdf",
                    file_extension="pdf", storage_type="GOOGLE_DRIVE",
                    google_drive_file_id="gone123", source="GOOGLE_DRIVE", sync_status="SYNCED"))
    db.commit()
    doc = db.query(Document).filter(Document.google_drive_file_id == "gone123").first()
    db.close()
    # no drive config connected -> 400, and no path/token leaked in body
    r = client.get(f"/api/documents/{doc.id}/preview", headers=h)
    assert r.status_code == 400
    assert "google_drive_file_id" not in r.text and "refresh_token" not in r.text


def test_preview_native_google_export(monkeypatch):
    """Native Google Docs are exported to PDF for preview; Forms are not."""
    import app.services.google_drive_service as gds
    from app.models.document import Document
    from app.models.google_drive import GoogleDriveConfig
    client = get_client()
    h = auth_header(client)
    db = SessionLocal()
    db.add(GoogleDriveConfig(is_active=True, access_token="t", refresh_token="r"))
    db.add(Document(name="native doc", original_name="native doc",
                    mime_type="application/vnd.google-apps.document",
                    file_extension="", storage_type="GOOGLE_DRIVE",
                    google_drive_file_id="nat1", google_drive_url="https://drive/x",
                    source="GOOGLE_DRIVE", sync_status="SYNCED"))
    db.add(Document(name="form", original_name="form",
                    mime_type="application/vnd.google-apps.form",
                    file_extension="", storage_type="GOOGLE_DRIVE",
                    google_drive_file_id="form1", google_drive_url="https://drive/y",
                    source="GOOGLE_DRIVE", sync_status="SYNCED"))
    db.commit()
    doc = db.query(Document).filter(Document.google_drive_file_id == "nat1").first()
    form = db.query(Document).filter(Document.google_drive_file_id == "form1").first()
    db.close()
    monkeypatch.setattr(gds, "get_drive_file_bytes", lambda db, cfg, fid: (b"%PDF-1.4 fake", "application/pdf", "native doc"))
    r = client.get(f"/api/documents/{doc.id}/preview", headers=h)
    assert r.status_code == 200
    assert "application/pdf" in r.headers["content-type"]
    assert r.headers["content-disposition"].startswith("inline")
    assert r.content == b"%PDF-1.4 fake"
    r = client.get(f"/api/documents/{form.id}/preview", headers=h)
    assert r.status_code == 400 and "Google Drive" in r.json()["detail"]


def _drive_file(fid, name, modified="2026-09-16T10:00:00Z"):
    return {"id": fid, "name": name, "mimeType": "application/pdf",
            "modifiedTime": modified, "webViewLink": f"https://drive/{fid}",
            "size": "100", "parents": ["f1"]}


def test_files_scope_sync_only_selected():
    from app.models.document import Document
    from app.models.google_drive import GoogleDriveConfig
    from app.services.sync_service import run_sync
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    cfg = GoogleDriveConfig(folder_id="f1", sync_scope="FILES", is_active=True)
    db.add(cfg)
    db.commit()
    # pre-existing SYNCED doc for an UNSELECTED file must stay untouched
    db.add(Document(name="B.pdf", original_name="B.pdf", file_extension="pdf",
                    storage_type="GOOGLE_DRIVE", google_drive_file_id="unselected-b",
                    source="GOOGLE_DRIVE", sync_status="SYNCED"))
    db.commit()
    batch = [_drive_file("sel-a", "A.pdf"), _drive_file("sel-c", "C.pdf")]
    log = run_sync(db, cfg, batch, scope_file_ids={"sel-a", "sel-c"})
    assert log.created_files == 2 and log.total_files == 2
    assert db.query(Document).filter(Document.google_drive_file_id == "sel-a").count() == 1
    assert db.query(Document).filter(Document.google_drive_file_id == "sel-c").count() == 1
    untouched = db.query(Document).filter(Document.google_drive_file_id == "unselected-b").first()
    assert untouched.sync_status == "SYNCED"
    # selected file deleted remotely -> REMOTE_MISSING, unselected still SYNCED
    log2 = run_sync(db, cfg, [_drive_file("sel-a", "A.pdf")], scope_file_ids={"sel-a", "sel-c"})
    assert db.query(Document).filter(Document.google_drive_file_id == "sel-c").first().sync_status == "REMOTE_MISSING"
    assert db.query(Document).filter(Document.google_drive_file_id == "unselected-b").first().sync_status == "SYNCED"
    assert log2.total_files == 1
    db.close()


def test_files_scope_selection_api_and_validation():
    from app.models.google_drive import GoogleDriveConfig
    client = get_client()
    h = auth_header(client)
    # simulate a connected Drive (OAuth callback creates this row in production)
    db = SessionLocal()
    db.add(GoogleDriveConfig(is_active=True, access_token="t", refresh_token="r"))
    db.commit()
    db.close()
    # FILES config with no selection -> 400
    r = client.post("/api/google-drive/config", headers=h, json={"sync_scope": "FILES"})
    assert r.status_code == 400 and "at least one file" in r.json()["detail"]
    # FOLDER config without folder -> 400
    r = client.post("/api/google-drive/config", headers=h, json={"sync_scope": "FOLDER"})
    assert r.status_code == 400 and "folder" in r.json()["detail"].lower()
    # save selection (dedupe: same id twice -> 1)
    r = client.post("/api/google-drive/sync-files", headers=h, json={"files": [
        {"file_id": "f1", "file_name": "A.pdf", "mime_type": "application/pdf"},
        {"file_id": "f1", "file_name": "A.pdf"},
        {"file_id": "f2", "file_name": "C.docx"},
    ]})
    assert r.status_code == 200 and len(r.json()) == 2
    # list
    r = client.get("/api/google-drive/sync-files", headers=h)
    assert r.status_code == 200 and {x["google_drive_file_id"] for x in r.json()} == {"f1", "f2"}
    # FILES config now saves
    r = client.post("/api/google-drive/config", headers=h, json={"sync_scope": "FILES"})
    assert r.status_code == 200 and r.json()["sync_scope"] == "FILES" and r.json()["selected_count"] == 2
    # remove one -> 1 left
    assert client.delete("/api/google-drive/sync-files/f2", headers=h).status_code == 200
    assert len(client.get("/api/google-drive/sync-files", headers=h).json()) == 1
    # legacy default scope is FOLDER
    r = client.get("/api/google-drive/status", headers=h)
    assert r.status_code == 200


def test_vietnamese_search_case_and_normalization():
    """Lowercase NFC query must match uppercase stored text incl. legacy NFD rows."""
    import unicodedata
    from app.models.document import Document
    from app.services.document_service import backfill_nfc
    client = get_client()
    h = auth_header(client)
    db = SessionLocal()
    nfd_upper = unicodedata.normalize("NFD", "THỎA THUẬN HỢP TÁC MARKETING SPA.docx")
    assert not unicodedata.is_normalized("NFC", nfd_upper)
    db.add(Document(name=nfd_upper, original_name=nfd_upper, file_extension="docx",
                    storage_type="LOCAL", source="LOCAL_UPLOAD", sync_status="NOT_SYNCED"))
    db.commit()
    # legacy rows get normalized by the backfill
    assert backfill_nfc(db) >= 1
    assert unicodedata.is_normalized("NFC", db.query(Document).first().name)
    db.close()
    for q in ["hợp", "HỢP", "thỏa thuận", "THỎA THUẬN", "marketing", "MARKETING", "thỏa thuận hợp tác"]:
        r = client.get("/api/documents", headers=h, params={"q": q})
        assert r.status_code == 200, r.text
        assert r.json()["total"] >= 1, f"query {q!r} found nothing"
    # new uploads normalize at write time
    r = client.post("/api/documents/upload", headers=h,
                    files={"file": (unicodedata.normalize("NFD", "Báo cáo tuần.docx"), b"x", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
                    data={"name": "x"})
    assert r.status_code == 200
    assert unicodedata.is_normalized("NFC", r.json()["name"])


def _client_with_staff():
    from app.models.user import User as _U
    client = get_client()
    db = SessionLocal()
    db.add(_U(name="Staff", email="staff@test.com", password_hash=hash_password("staff123"), role="USER"))
    db.commit()
    db.close()
    return client


def _login(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_user_admin_update_and_reset():
    client = _client_with_staff()
    ha = auth_header(client)
    hs = _login(client, "staff@test.com", "staff123")
    # non-admin cannot list users
    assert client.get("/api/auth/users", headers=hs).status_code == 403
    staff_id = next(u["id"] for u in client.get("/api/auth/users", headers=ha).json() if u["email"] == "staff@test.com")
    # short password rejected
    r = client.post("/api/auth/users", headers=ha, json={"name": "X", "email": "x@test.com", "password": "123", "role": "USER"})
    assert r.status_code == 422, r.text
    # deactivate staff -> login fails
    r = client.put(f"/api/auth/users/{staff_id}", headers=ha, json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert client.post("/api/auth/login", json={"email": "staff@test.com", "password": "staff123"}).status_code in (401, 403)
    # reactivate + promote
    r = client.put(f"/api/auth/users/{staff_id}", headers=ha, json={"is_active": True, "role": "ADMIN"})
    assert r.status_code == 200 and r.json()["role"] == "ADMIN"
    # invalid role
    assert client.put(f"/api/auth/users/{staff_id}", headers=ha, json={"role": "SUPER"}).status_code == 400
    # self-demote / self-deactivate blocked
    admin_id = next(u["id"] for u in client.get("/api/auth/users", headers=ha).json() if u["email"] == "admin@test.com")
    assert client.put(f"/api/auth/users/{admin_id}", headers=ha, json={"role": "USER"}).status_code == 400
    assert client.put(f"/api/auth/users/{admin_id}", headers=ha, json={"is_active": False}).status_code == 400
    # reset password returns one-time temp password
    r = client.post(f"/api/auth/users/{staff_id}/reset-password", headers=ha)
    assert r.status_code == 200 and r.json()["temporary_password"]
    assert client.post("/api/auth/login", json={"email": "staff@test.com", "password": r.json()["temporary_password"]}).status_code == 200
    # 404 for unknown user
    assert client.put("/api/auth/users/nope", headers=ha, json={"name": "Z"}).status_code == 404


def test_tag_delete_admin_only_and_category_update_dup():
    client = _client_with_staff()
    ha = auth_header(client)
    hs = _login(client, "staff@test.com", "staff123")
    r = client.post("/api/tags", headers=hs, json={"name": "hop-dong"})
    assert r.status_code == 200
    tag_id = r.json()["id"]
    # staff cannot delete tag anymore
    assert client.delete(f"/api/tags/{tag_id}", headers=hs).status_code == 403
    assert client.delete(f"/api/tags/{tag_id}", headers=ha).status_code == 200
    # category update duplicate -> 409
    assert client.post("/api/categories", headers=ha, json={"name": "Cat A"}).status_code == 200
    assert client.post("/api/categories", headers=ha, json={"name": "Cat B"}).status_code == 200
    cats = {c["name"]: c["id"] for c in client.get("/api/categories", headers=ha).json()}
    assert client.put(f"/api/categories/{cats['Cat B']}", headers=ha, json={"name": "Cat A"}).status_code == 409


def test_audit_trail_and_viewer():
    from app.models.audit_log import AuditLog
    client = get_client()
    h = auth_header(client)
    db = SessionLocal()
    # upload audit must carry document_id (flush-before-audit fix)
    r = client.post("/api/documents/upload", headers=h,
                    files={"file": ("audit.txt", b"abc", "text/plain")}, data={"name": "audit.txt"})
    assert r.status_code == 200
    doc_id = r.json()["id"]
    up = db.query(AuditLog).filter(AuditLog.action == "UPLOAD").order_by(AuditLog.created_at.desc()).first()
    assert up is not None and up.document_id == doc_id and up.user_id is not None
    # download audit
    assert client.get(f"/api/documents/{doc_id}/download", headers=h).status_code == 200
    assert db.query(AuditLog).filter(AuditLog.action == "DOWNLOAD", AuditLog.document_id == doc_id).count() >= 1
    db.close()
    # failed login is audited
    assert client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong"}).status_code == 401
    db = SessionLocal()
    assert db.query(AuditLog).filter(AuditLog.action == "LOGIN_FAIL").count() >= 1
    db.close()
    # audit viewer: admin ok, timing check via filter
    r = client.get("/api/audit-logs", headers=h, params={"action": "UPLOAD"})
    assert r.status_code == 200 and r.json()["total"] >= 1
    assert r.json()["items"][0]["user_email"] == "admin@test.com"
    # non-admin staff gets 403
    client2 = _client_with_staff()
    hs = _login(client2, "staff@test.com", "staff123")
    assert client2.get("/api/audit-logs", headers=hs).status_code == 403


def test_drive_token_crypto_roundtrip_and_passthrough():
    from app.services import token_crypto
    from cryptography.fernet import Fernet
    # no key in test env -> plaintext passthrough
    assert token_crypto._fernet() is None
    assert token_crypto.protect_token("abc") == "abc"
    assert token_crypto.reveal_token("abc") == "abc"
    assert token_crypto.protect_token(None) is None
    # with key -> enc: roundtrip
    key = Fernet.generate_key().decode()
    old = token_crypto.settings.DRIVE_TOKEN_KEY
    token_crypto.settings.DRIVE_TOKEN_KEY = key
    try:
        enc = token_crypto.protect_token("secret-token")
        assert enc.startswith("enc:") and enc != "secret-token"
        assert token_crypto.reveal_token(enc) == "secret-token"
        # idempotent + wrong key fails loudly
        assert token_crypto.protect_token(enc) == enc
        token_crypto.settings.DRIVE_TOKEN_KEY = Fernet.generate_key().decode()
        try:
            token_crypto.reveal_token(enc)
            raise AssertionError("wrong key must fail")
        except RuntimeError:
            pass
    finally:
        token_crypto.settings.DRIVE_TOKEN_KEY = old


def test_document_visibility_acl():
    client = _client_with_staff()
    ha = auth_header(client)
    hs = _login(client, "staff@test.com", "staff123")
    # admin uploads a PRIVATE doc
    r = client.post("/api/documents/upload", headers=ha,
                    files={"file": ("priv.txt", b"s3cret", "text/plain")},
                    data={"name": "priv.txt", "visibility": "PRIVATE"})
    assert r.status_code == 200
    priv_id = r.json()["id"]
    # staff cannot read/download it
    assert client.get(f"/api/documents/{priv_id}", headers=hs).status_code == 403
    assert client.get(f"/api/documents/{priv_id}/download", headers=hs).status_code == 403
    assert "priv.txt" not in [d["name"] for d in client.get("/api/documents", headers=hs).json()["items"]]
    # admin can
    assert client.get(f"/api/documents/{priv_id}", headers=ha).status_code == 200
    # staff's own PRIVATE doc is visible to staff, hidden from... (only 2 users; admin sees all)
    r = client.post("/api/documents/upload", headers=hs,
                    files={"file": ("mine.txt", b"x", "text/plain")},
                    data={"name": "mine.txt", "visibility": "PRIVATE"})
    assert r.status_code == 200
    assert client.get(f"/api/documents/{r.json()['id']}", headers=hs).status_code == 200
    # DEPARTMENT without department -> 400
    r = client.post("/api/documents/upload", headers=hs,
                    files={"file": ("d.txt", b"x", "text/plain")},
                    data={"name": "d.txt", "visibility": "DEPARTMENT"})
    assert r.status_code == 400
    # give staff a department, upload DEPARTMENT doc visible to same-dept peer
    staff_id = next(u["id"] for u in client.get("/api/auth/users", headers=ha).json() if u["email"] == "staff@test.com")
    assert client.put(f"/api/auth/users/{staff_id}", headers=ha, json={"department": "Ke toan"}).status_code == 200
    r = client.post("/api/documents/upload", headers=hs,
                    files={"file": ("dept.txt", b"x", "text/plain")},
                    data={"name": "dept.txt", "visibility": "DEPARTMENT"})
    assert r.status_code == 200
    dept_id = r.json()["id"]
    assert r.json()["department"] == "Ke toan"
    assert client.get(f"/api/documents/{dept_id}", headers=hs).status_code == 200
    assert client.get(f"/api/documents/{dept_id}", headers=ha).status_code == 200  # admin bypass
    # scope=mine only returns own uploads
    names = [d["name"] for d in client.get("/api/documents", headers=hs, params={"scope": "mine"}).json()["items"]]
    assert "mine.txt" in names and "priv.txt" not in names

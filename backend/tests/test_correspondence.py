import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_corr.db")
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
    db.add(User(name="Staff", email="staff@test.com", password_hash=hash_password("staff123"), role="USER"))
    db.commit()
    db.close()
    return TestClient(create_app())


def login(client, email="admin@test.com", password="admin123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def make_type(client, h, code="CV01", name="Công văn"):
    r = client.post("/api/correspondence/types", headers=h, json={"code": code, "name": name})
    assert r.status_code == 200, r.text
    return r.json()


def base_out(tid):
    return {"document_number": "CV001/2026/VICENZA", "recipient": "Công ty ABC",
            "signer": "Nguyễn Văn A", "document_type_id": tid,
            "issuing_department": "Hành chính", "issue_date": "2026-09-17"}


def test_outgoing_crud_and_duplicate():
    c, h = get_client(), None
    h = login(c)
    t = make_type(c, h)
    r = c.post("/api/correspondence/outgoing", headers=h, json=base_out(t["id"]))
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    # duplicate number same direction -> 400
    r = c.post("/api/correspondence/outgoing", headers=h, json=base_out(t["id"]))
    assert r.status_code == 400 and "đã tồn tại" in r.text
    # same number in INCOMING is allowed
    body = base_out(t["id"])
    body["sender"] = "Sở XYZ"
    r = c.post("/api/correspondence/incoming", headers=h, json=body)
    assert r.status_code == 200, r.text
    # get / update / delete
    assert c.get(f"/api/correspondence/outgoing/{cid}", headers=h).status_code == 200
    r = c.put(f"/api/correspondence/outgoing/{cid}", headers=h, json={"processing_status": "ISSUED"})
    assert r.status_code == 200 and r.json()["processing_status"] == "ISSUED"
    assert c.delete(f"/api/correspondence/outgoing/{cid}", headers=h).status_code == 200
    assert c.get(f"/api/correspondence/outgoing/{cid}", headers=h).status_code == 404


def test_validation_and_enums():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    bad = base_out(t["id"])
    bad["document_number"] = ""
    assert c.post("/api/correspondence/outgoing", headers=h, json=bad).status_code == 400
    bad = base_out(t["id"])
    bad["security_level"] = "TOPSECRET"
    assert c.post("/api/correspondence/outgoing", headers=h, json=bad).status_code == 400
    bad = base_out(t["id"])
    bad["document_type_id"] = "00000000-0000-0000-0000-000000000000"
    assert c.post("/api/correspondence/outgoing", headers=h, json=bad).status_code == 400
    # inactive type rejected
    r = c.put(f"/api/correspondence/types/{t['id']}", headers=h,
              json={"code": t["code"], "name": t["name"], "status": "INACTIVE"})
    assert r.status_code == 200
    assert c.post("/api/correspondence/outgoing", headers=h, json=base_out(t["id"])).status_code == 400


def test_search_filter_pagination():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    for i in range(1, 4):
        b = base_out(t["id"])
        b["document_number"] = f"CV00{i}/2026/VICENZA"
        b["signer"] = "Trần Thị B" if i == 3 else "Nguyễn Văn A"
        r = c.post("/api/correspondence/outgoing", headers=h, json=b)
        assert r.status_code == 200, r.text
    r = c.get("/api/correspondence/outgoing", headers=h, params={"q": "trần"})
    assert r.json()["total"] == 1
    r = c.get("/api/correspondence/outgoing", headers=h, params={"signer": "Nguyễn"})
    assert r.json()["total"] == 2
    r = c.get("/api/correspondence/outgoing", headers=h, params={"page": 1, "page_size": 2})
    assert r.json()["total"] == 3 and len(r.json()["items"]) == 2 and r.json()["total_pages"] == 2


def test_types_delete_guard_and_settings():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    c.post("/api/correspondence/outgoing", headers=h, json=base_out(t["id"]))
    assert c.delete(f"/api/correspondence/types/{t['id']}", headers=h).status_code == 409
    # settings require admin
    hs = login(c, "staff@test.com", "staff123")
    assert c.put("/api/correspondence/settings/OUTGOING", headers=hs, json={"prefix": "CV"}).status_code == 403
    r = c.put("/api/correspondence/settings/OUTGOING", headers=h,
              json={"current_number": 125, "number_length": 3, "prefix": "CV", "suffix": "/2026/VICENZA"})
    assert r.status_code == 200
    r = c.get("/api/correspondence/next-number", headers=h, params={"direction": "OUTGOING"})
    assert r.json()["next_number"] == "CV126/2026/VICENZA"
    # using the generated number bumps the counter
    b = base_out(t["id"])
    b["document_number"] = "CV126/2026/VICENZA"
    assert c.post("/api/correspondence/outgoing", headers=h, json=b).status_code == 200
    r = c.get("/api/correspondence/next-number", headers=h, params={"direction": "OUTGOING"})
    assert r.json()["next_number"] == "CV127/2026/VICENZA"


def test_import_partial_and_limits():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    rows = [
        {**base_out(t["id"]), "document_number": "CV001/2026/VICENZA"},
        {"document_number": "", "recipient": "ABC", "signer": "A",
         "document_type_id": t["id"], "issuing_department": "HC"},  # missing number
        {**base_out(t["id"]), "document_number": "CV001/2026/VICENZA"},  # dup in file
    ]
    r = c.post("/api/correspondence/outgoing/import", headers=h, json={"rows": rows})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total"] == 3 and body["success"] == 1 and body["failed"] == 2
    assert len(body["errors"]) == 2
    # over the row cap
    r = c.post("/api/correspondence/outgoing/import", headers=h, json={"rows": [{}] * 501})
    assert r.status_code == 400


def test_delete_permission_and_attachments_kept():
    c = get_client()
    ha, hs = login(c), login(c, "staff@test.com", "staff123")
    t = make_type(c, ha)
    # upload a file then attach
    up = c.post("/api/documents/upload", headers=ha,
                files={"file": ("a.txt", b"hello", "text/plain")}, data={"name": "a.txt"})
    assert up.status_code == 200
    did = up.json()["id"]
    b = base_out(t["id"])
    b["attachment_ids"] = [did]
    b["links"] = [{"name": "Drive", "url": "https://drive.google.com/x"}]
    r = c.post("/api/correspondence/outgoing", headers=hs, json=b)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    assert len(r.json()["attachments"]) == 1 and len(r.json()["links"]) == 1
    # admin cannot delete staff's? admin CAN; staff cannot delete admin's
    r2 = c.post("/api/correspondence/outgoing", headers=ha, json={**base_out(t["id"]), "document_number": "CV009/2026"})
    assert c.delete(f"/api/correspondence/outgoing/{r2.json()['id']}", headers=hs).status_code == 403
    # staff deletes own -> physical file kept
    assert c.delete(f"/api/correspondence/outgoing/{cid}", headers=hs).status_code == 200
    assert c.get(f"/api/documents/{did}/download", headers=ha).status_code == 200

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_topic.db")
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


def test_topic_crud_guards_and_corr_filter():
    c = get_client()
    admin, staff = login(c), login(c, "staff@test.com", "staff123")

    # staff chi duoc xem
    r = c.post("/api/topics", headers=staff, json={"name": "Lương"})
    assert r.status_code == 403
    assert c.get("/api/topics", headers=staff).json() == []

    # tao + trung (case-insensitive) -> 409
    r = c.post("/api/topics", headers=admin, json={"name": "Lương"})
    assert r.status_code == 200, r.text
    tid = r.json()["id"]
    assert c.post("/api/topics", headers=admin, json={"name": "  lương  "}).status_code == 409

    # active_only
    assert len(c.get("/api/topics", headers=staff).json()) == 1
    c.put(f"/api/topics/{tid}", headers=admin, json={"name": "Lương", "status": "INACTIVE"})
    assert c.get("/api/topics", headers=staff, params={"active_only": True}).json() == []
    c.put(f"/api/topics/{tid}", headers=admin, json={"name": "Lương", "status": "ACTIVE"})

    # loc cong van noi bo theo topic
    t = c.post("/api/correspondence/types", headers=admin, json={"code": "T1", "name": "Loai"}).json()
    for num, topic in (("NB/T1", "Lương"), ("NB/T2", "Nhân sự")):
        r = c.post("/api/correspondence/internal", headers=admin, json={
            "document_number": num, "recipient": "P. Kế toán", "signer": "A",
            "document_type_id": t["id"], "issuing_department": "Cty",
            "topic": topic})
        assert r.status_code == 200, r.text
    got = c.get("/api/correspondence/internal", headers=staff, params={"topic": "Lương"}).json()
    assert [d["document_number"] for d in got["items"]] == ["NB/T1"], got

    # xoa
    assert c.delete(f"/api/topics/{tid}", headers=staff).status_code == 403
    assert c.delete(f"/api/topics/{tid}", headers=admin).status_code == 200

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_recv_unit.db")
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


def test_receiving_unit_crud_and_guards():
    c = get_client()
    admin, staff = login(c), login(c, "staff@test.com", "staff123")

    # staff (member) chỉ được xem, không được tạo
    r = c.post("/api/receiving-units", headers=staff, json={"name": "Công ty A"})
    assert r.status_code == 403
    assert c.get("/api/receiving-units", headers=staff).json() == []

    # tạo + trùng tên (case-insensitive) -> 409
    r = c.post("/api/receiving-units", headers=admin, json={"name": "Công ty A"})
    assert r.status_code == 200, r.text
    uid = r.json()["id"]
    r = c.post("/api/receiving-units", headers=admin, json={"name": "  công ty a  "})
    assert r.status_code == 409

    # list + active_only
    assert len(c.get("/api/receiving-units", headers=staff).json()) == 1
    r = c.put(f"/api/receiving-units/{uid}", headers=admin, json={"name": "Công ty A", "status": "INACTIVE"})
    assert r.status_code == 200 and r.json()["status"] == "INACTIVE"
    assert c.get("/api/receiving-units", headers=staff, params={"active_only": True}).json() == []
    assert len(c.get("/api/receiving-units", headers=staff).json()) == 1

    # sửa xong xóa
    r = c.put(f"/api/receiving-units/{uid}", headers=admin, json={"name": "Công ty B", "status": "ACTIVE"})
    assert r.status_code == 200 and r.json()["name"] == "Công ty B"
    assert c.delete(f"/api/receiving-units/{uid}", headers=staff).status_code == 403
    assert c.delete(f"/api/receiving-units/{uid}", headers=admin).status_code == 200
    assert c.get("/api/receiving-units", headers=staff).json() == []
    assert c.delete(f"/api/receiving-units/{uid}", headers=admin).status_code == 404

import os
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_dept.db")
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


def test_department_crud_and_guards():
    c = get_client()
    admin, staff = login(c), login(c, "staff@test.com", "staff123")

    # staff không được tạo
    r = c.post("/api/departments", headers=staff, json={"name": "Kế toán"})
    assert r.status_code == 403

    # tạo + trùng tên (case-insensitive) -> 409
    r = c.post("/api/departments", headers=admin, json={"name": "Kế toán"})
    assert r.status_code == 200, r.text
    did = r.json()["id"]
    r = c.post("/api/departments", headers=admin, json={"name": "  kế toán  "})
    assert r.status_code == 409

    # list + active_only
    assert len(c.get("/api/departments", headers=staff).json()) == 1
    r = c.put(f"/api/departments/{did}", headers=admin, json={"name": "Kế toán", "status": "INACTIVE"})
    assert r.status_code == 200 and r.json()["status"] == "INACTIVE"
    assert c.get("/api/departments", headers=staff, params={"active_only": True}).json() == []
    assert len(c.get("/api/departments", headers=staff).json()) == 1

    # sửa xong xóa
    r = c.put(f"/api/departments/{did}", headers=admin, json={"name": "Kế toán tổng hợp", "status": "ACTIVE"})
    assert r.status_code == 200 and r.json()["name"] == "Kế toán tổng hợp"
    assert c.delete(f"/api/departments/{did}", headers=admin).status_code == 200
    assert c.get("/api/departments", headers=staff).json() == []
    assert c.delete(f"/api/departments/{did}", headers=admin).status_code == 404

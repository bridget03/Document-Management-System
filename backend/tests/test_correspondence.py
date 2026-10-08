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


def test_list_sorts_visible_columns():
    c, h = get_client(), login(get_client())
    first = make_type(c, h, code="CV-A", name="Alpha")
    second = make_type(c, h, code="CV-Z", name="Zulu")
    c.post("/api/correspondence/outgoing", headers=h, json={
        **base_out(second["id"]), "document_number": "CV002", "recipient": "Zulu Corp",
        "signer": "Zed", "issue_date": "2026-09-18", "processing_status": "ISSUED",
    })
    c.post("/api/correspondence/outgoing", headers=h, json={
        **base_out(first["id"]), "document_number": "CV001", "recipient": "Alpha Corp",
        "signer": "Alice", "issue_date": "2026-09-17", "processing_status": "DRAFT",
    })
    for sort_by in ("document_number", "document_type", "party", "signer", "signed_date", "issue_date", "processing_status"):
        r = c.get("/api/correspondence/outgoing", headers=h, params={"sort_by": sort_by, "sort_order": "asc"})
        assert r.status_code == 200, r.text
    r = c.get("/api/correspondence/outgoing", headers=h, params={"sort_by": "document_type", "sort_order": "asc", "q": "corp"})
    assert r.status_code == 200, r.text
    assert [item["document_number"] for item in r.json()["items"]] == ["CV001", "CV002"]


def test_personal_folders_move_and_filter_documents():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    first = c.post("/api/correspondence/outgoing", headers=h, json={
        **base_out(t["id"]), "document_number": "FOLDER-001",
    }).json()
    second = c.post("/api/correspondence/outgoing", headers=h, json={
        **base_out(t["id"]), "document_number": "FOLDER-002",
    }).json()
    folder = c.post("/api/correspondence/folders", headers=h, json={
        "name": "Hồ sơ dự án", "direction": "OUTGOING",
    })
    assert folder.status_code == 200, folder.text
    folder_id = folder.json()["id"]
    child = c.post("/api/correspondence/folders", headers=h, json={
        "name": "Hồ sơ ký", "direction": "OUTGOING", "parent_id": folder_id,
    })
    assert child.status_code == 200 and child.json()["parent_id"] == folder_id
    moved = c.post(f"/api/correspondence/folders/{folder_id}/documents", headers=h, json={
        "document_ids": [first["id"]],
    })
    assert moved.status_code == 200, moved.text
    folders = c.get("/api/correspondence/folders", headers=h, params={"direction": "OUTGOING"})
    assert folders.status_code == 200
    assert next(item for item in folders.json() if item["id"] == folder_id)["item_count"] == 1
    listed = c.get("/api/correspondence/outgoing", headers=h, params={"folder_id": folder_id})
    assert listed.status_code == 200 and [item["id"] for item in listed.json()["items"]] == [first["id"]]
    # Moving to another folder replaces the current user's old placement.
    other = c.post("/api/correspondence/folders", headers=h, json={"name": "Lưu trữ", "direction": "OUTGOING"}).json()
    c.post(f"/api/correspondence/folders/{other['id']}/documents", headers=h, json={"document_ids": [first["id"]]})
    assert c.get("/api/correspondence/outgoing", headers=h, params={"folder_id": folder_id}).json()["total"] == 0
    assert second["id"] != first["id"]


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
    # member read-only: staff cannot create (single + import) -> 403
    assert c.post("/api/correspondence/outgoing", headers=hs, json=base_out(t["id"])).status_code == 403
    assert c.post("/api/correspondence/outgoing/import", headers=hs, json={"rows": []}).status_code == 403
    # upload a file then attach (admin creates)
    up = c.post("/api/documents/upload", headers=ha,
                files={"file": ("a.txt", b"hello", "text/plain")}, data={"name": "a.txt"})
    assert up.status_code == 200
    did = up.json()["id"]
    b = base_out(t["id"])
    b["attachment_ids"] = [did]
    b["links"] = [{"name": "Drive", "url": "https://drive.google.com/x"}]
    r = c.post("/api/correspondence/outgoing", headers=ha, json=b)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    assert len(r.json()["attachments"]) == 1 and len(r.json()["links"]) == 1
    # staff cannot delete admin's (403); admin deletes own -> physical file kept
    assert c.delete(f"/api/correspondence/outgoing/{cid}", headers=hs).status_code == 403
    assert c.delete(f"/api/correspondence/outgoing/{cid}", headers=ha).status_code == 200
    assert c.get(f"/api/documents/{did}/download", headers=ha).status_code == 200


def test_internal_crud_search_import():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    # missing internal recipient -> 400
    bad = {"document_number": "NB001", "signer": "A",
           "document_type_id": t["id"], "issuing_department": "HC"}
    assert c.post("/api/correspondence/internal", headers=h, json=bad).status_code == 400
    # create with Bộ phận/người nhận, sender optional
    good = {**bad, "recipient": "Phòng Kế toán"}
    r = c.post("/api/correspondence/internal", headers=h, json=good)
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    assert r.json()["direction"] == "INTERNAL"
    # same number allowed in other directions (isolated uniqueness)
    assert c.post("/api/correspondence/outgoing", headers=h, json={
        **base_out(t["id"]), "document_number": "NB001"}).status_code == 200
    # get / search / filter / update / delete
    assert c.get(f"/api/correspondence/internal/{cid}", headers=h).status_code == 200
    r = c.get("/api/correspondence/internal", headers=h, params={"q": "kế toán"})
    assert r.json()["total"] == 1
    r = c.put(f"/api/correspondence/internal/{cid}", headers=h, json={"processing_status": "APPROVED"})
    assert r.status_code == 200 and r.json()["processing_status"] == "APPROVED"
    # import with one bad row
    r = c.post("/api/correspondence/internal/import", headers=h, json={"rows": [
        {"document_number": "NB002", "recipient": "Phòng HC", "signer": "B",
         "document_type_id": t["id"], "issuing_department": "HC"},
        {"document_number": "", "recipient": "Phòng HC", "signer": "B",
         "document_type_id": t["id"], "issuing_department": "HC"},
    ]})
    assert r.json()["success"] == 1 and r.json()["failed"] == 1
    assert c.delete(f"/api/correspondence/internal/{cid}", headers=h).status_code == 200
    # numbering config exists for INTERNAL
    r = c.get("/api/correspondence/next-number", headers=h, params={"direction": "INTERNAL"})
    assert r.status_code == 200 and "next_number" in r.json()


def test_phase_permissions_no_doc_or_dept_scoping():
    """Phase rule: member read-only on correspondence (admin/owner writes);
    types/numbering settings stay ADMIN-only."""
    from app.core.permissions import (
        can_create_corr, can_delete_corr, can_edit_corr,
        can_manage_corr_config, can_view_corr,
    )
    c = get_client()
    ha, hs = login(c), login(c, "staff@test.com", "staff123")
    t = make_type(c, ha)
    assert can_view_corr(object()) is True

    class FakeUser:
        def __init__(self, role, uid):
            self.role, self.id = role, uid

    assert can_manage_corr_config(FakeUser("USER", "u1")) is False
    assert can_manage_corr_config(FakeUser("ADMIN", "a")) is True

    admin, staff, other = FakeUser("ADMIN", "a"), FakeUser("USER", "u1"), FakeUser("USER", "u2")
    # create correspondence: ADMIN only, member read-only
    assert can_create_corr(admin, "INCOMING") is True
    assert can_create_corr(admin, "OUTGOING") is True
    assert can_create_corr(staff, "INTERNAL") is False

    class FakeDoc:
        created_by = "u1"
    assert can_edit_corr(staff, FakeDoc()) is True
    assert can_edit_corr(other, FakeDoc()) is False
    assert can_edit_corr(admin, FakeDoc()) is True
    assert can_delete_corr(other, FakeDoc()) is False

    # staff reads admin's INTERNAL doc (different department) -> allowed
    r = c.post("/api/correspondence/internal", headers=ha, json={
        "document_number": "NB-SEC-001", "recipient": "Ban Giám đốc",
        "signer": "GĐ", "document_type_id": t["id"], "issuing_department": "Văn phòng"})
    assert r.status_code == 200
    cid = r.json()["id"]
    assert c.get(f"/api/correspondence/internal/{cid}", headers=hs).status_code == 200
    assert c.get("/api/correspondence/internal", headers=hs, params={"q": "giám đốc"}).json()["total"] == 1
    # ...but staff cannot edit/delete it
    assert c.put(f"/api/correspondence/internal/{cid}", headers=hs, json={"notes": "x"}).status_code == 403
    assert c.delete(f"/api/correspondence/internal/{cid}", headers=hs).status_code == 403
    # ...and cannot touch types catalogue
    assert c.post("/api/correspondence/types", headers=hs, json={"code": "X", "name": "X"}).status_code == 403


def test_dashboard_stats():
    c, h = get_client(), login(get_client())
    t = make_type(c, h)
    for i, d in enumerate(["INCOMING", "OUTGOING", "INTERNAL"]):
        body = base_out(t["id"])
        body["document_number"] = f"DSH-{i}"
        if d == "INCOMING":
            body["sender"] = "Sở A"
        else:
            body["recipient"] = "Phòng A"
        path = {"INCOMING": "incoming", "OUTGOING": "outgoing", "INTERNAL": "internal"}[d]
        assert c.post(f"/api/correspondence/{path}", headers=h, json=body).status_code == 200
    # unauthenticated -> 401
    assert c.get("/api/dashboard/stats").status_code == 401
    r = c.get("/api/dashboard/stats", headers=h)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["overview"]["incoming"] == 1 and s["overview"]["outgoing"] == 1 and s["overview"]["internal"] == 1
    assert s["overview"]["total_documents"] >= 0
    assert sum(p["incoming"] for p in s["trend"]) == 1
    assert any(p["status"] == "DRAFT" for p in s["processing_status"])
    assert any(t["code"] == "CV01" for t in s["document_types"])
    assert s["top_recipients"] and s["top_senders"]
    # custom range with no data -> empty trend, still 200
    r = c.get("/api/dashboard/stats", headers=h, params={"from_date": "2000-01-01", "to_date": "2000-01-31"})
    assert r.status_code == 200 and r.json()["trend"] == []


def test_corr_visibility_acl_and_attach_guard():
    c = get_client()
    ha = login(c)
    hs = login(c, "staff@test.com", "staff123")
    t = make_type(c, ha, code="ACL1", name="ACL")
    # admin creates PRIVATE outgoing
    body = base_out(t["id"])
    body.update({"document_number": "PRIV/1", "visibility": "PRIVATE"})
    r = c.post("/api/correspondence/outgoing", headers=ha, json=body)
    assert r.status_code == 200, r.text
    priv_id = r.json()["id"]
    assert r.json()["visibility"] == "PRIVATE"
    # staff cannot read it, sees empty list
    assert c.get(f"/api/correspondence/outgoing/{priv_id}", headers=hs).status_code == 403
    assert c.get("/api/correspondence/outgoing", headers=hs).json()["total"] == 0
    # admin sees it
    assert c.get(f"/api/correspondence/outgoing/{priv_id}", headers=ha).status_code == 200
    # attach guard (service level): viewer without read right cannot attach.
    # (Staff khong tao duoc cong van nua nen scenario nay test truc tiep service.)
    from app.models.correspondence import CorrespondenceDocument as CD
    from app.models.document import Document
    from app.services import correspondence_service as svc
    db = SessionLocal()
    db.add(Document(name="p.pdf", original_name="p.pdf", file_extension="pdf",
                    storage_type="LOCAL", source="LOCAL_UPLOAD", sync_status="NOT_SYNCED",
                    visibility="PRIVATE", uploaded_by=db.query(User).filter(User.email == "admin@test.com").first().id))
    db.commit()
    priv_doc = db.query(Document).filter(Document.name == "p.pdf").first()
    staff_id = db.query(User).filter(User.email == "staff@test.com").first().id
    target = db.query(CD).filter(CD.id == priv_id).first()
    try:
        svc.attach_documents(db, target, [priv_doc.id], viewer_id=staff_id)
        db.rollback()
        raise AssertionError("expected ValueError")
    except ValueError as e:
        db.rollback()
        assert "quyền" in str(e)
    db.close()
    # DEPARTMENT visibility requires department
    body3 = base_out(t["id"])
    body3.update({"document_number": "ST/2", "visibility": "DEPARTMENT"})
    r = c.post("/api/correspondence/outgoing", headers=ha, json=body3)
    assert r.status_code == 400
    # invalid visibility
    body3.update({"document_number": "ST/3", "visibility": "GALAXY", "department": "Ke toan"})
    r = c.post("/api/correspondence/outgoing", headers=ha, json=body3)
    assert r.status_code == 400


def test_expiring_soon_boundaries():
    from datetime import date, timedelta
    from app.services.dashboard_service import get_stats, parse_range
    c = get_client()
    ha = login(c)
    t = make_type(c, ha, code="EXP1", name="Exp")
    today = date.today()
    cases = [
        ("EXP/TODAY", today, True),          # hết hạn hôm nay -> báo (days_left=0)
        ("EXP/D10", today + timedelta(days=10), True),   # đúng 10 ngày -> báo
        ("EXP/D11", today + timedelta(days=11), False),  # 11 ngày -> không báo
        ("EXP/PAST", today - timedelta(days=1), False),  # đã quá hạn -> không báo
    ]
    for num, exp, _ in cases:
        body = base_out(t["id"])
        body.update({"document_number": num, "expiry_date": exp.isoformat()})
        r = c.post("/api/correspondence/outgoing", headers=ha, json=body)
        assert r.status_code == 200, r.text
    body = base_out(t["id"])
    body.update({"document_number": "EXP/NONE"})
    assert c.post("/api/correspondence/outgoing", headers=ha, json=body).status_code == 200
    from_d, to_d = parse_range(None, None)
    db = SessionLocal()
    stats = get_stats(db, from_d, to_d)
    db.close()
    got = {e["document_number"]: e["days_left"] for e in stats["expiring_soon"]}
    assert got.get("EXP/TODAY") == 0
    assert got.get("EXP/D10") == 10
    assert "EXP/D11" not in got and "EXP/PAST" not in got and "EXP/NONE" not in got
    # sắp xếp tăng dần days_left
    days = [e["days_left"] for e in stats["expiring_soon"]]
    assert days == sorted(days)


def test_internal_department_scope_filters_by_recipient():
    """Cong van noi bo: scope=department ("Phong toi") loc theo dia chi nhan
    (Bo phan/nguoi nhan), khong phai phong duoc chia se."""
    c = get_client()
    ha, hs = login(c), login(c, "staff@test.com", "staff123")
    db = SessionLocal()
    staff = db.query(User).filter(User.email == "staff@test.com").first()
    staff.department = "Phòng Kế toán"
    db.commit()
    db.close()
    t = make_type(c, ha, code="NBDEP", name="Noi bo")
    for num, recv in (("NB/1", "Phòng Kế toán"), ("NB/2", "Phòng Nhân sự"),
                      ("NB/3", "Phòng Kế toán; Phòng Nhân sự")):
        r = c.post("/api/correspondence/internal", headers=ha, json={
            "document_number": num, "recipient": recv,
            "document_type_id": t["id"], "issuing_department": "Cty X"})
        assert r.status_code == 200, r.text
    got = c.get("/api/correspondence/internal", headers=hs,
                params={"scope": "department"}).json()
    assert sorted(d["document_number"] for d in got["items"]) == ["NB/1", "NB/3"], got
    # scope=all van thay ca 3
    got = c.get("/api/correspondence/internal", headers=hs).json()
    assert got["total"] == 3

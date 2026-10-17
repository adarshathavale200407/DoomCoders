import asyncio

import pytest
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient

import main
from scoring import priority_label, text_similarity
from seed import create_users, seed

LAT, LNG = 10.0, 10.0  # far from the seeded demo city


@pytest.fixture()
def client():
    with TestClient(main.app) as c:
        mock = AsyncMongoMockClient()
        main.app.state.client = mock
        main.app.state.db = mock["test"]
        yield c


def register(client, name, email):
    r = client.post("/auth/register", json={"name": name, "email": email, "password": "secret1"})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def login(client, email, password):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def report(client, headers, **over):
    body = {
        "title": "Deep pothole on Station Road",
        "description": "Large pothole near the bus stop damaging vehicles",
        "category": "pothole",
        "severity": 4,
        "lat": LAT,
        "lng": LNG,
    }
    body.update(over)
    r = client.post("/issues", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_register_login_me(client):
    h = register(client, "Asha", "asha@example.org")
    assert client.get("/auth/me", headers=h).json()["role"] == "citizen"
    assert client.post("/auth/register", json={"name": "Asha", "email": "asha@example.org", "password": "secret1"}).status_code == 409
    assert client.post("/auth/login", json={"email": "asha@example.org", "password": "wrong"}).status_code == 401
    assert client.post("/issues", json={}).status_code in (401, 422)


def test_duplicate_detection_and_flagging(client):
    a = register(client, "Asha", "a@example.org")
    b = register(client, "Bala", "b@example.org")
    first = report(client, a)

    near = client.post("/issues/check-duplicates", json={
        "category": "pothole", "lat": LAT + 0.0003, "lng": LNG,
        "title": "Pothole near Station Road", "description": "big pothole at the bus stop",
    }).json()
    assert len(near) == 1 and near[0]["id"] == first["id"] and near[0]["confidence"] > 0.5

    far = client.post("/issues/check-duplicates", json={
        "category": "pothole", "lat": LAT + 0.01, "lng": LNG}).json()
    assert far == []
    other_cat = client.post("/issues/check-duplicates", json={
        "category": "garbage", "lat": LAT, "lng": LNG}).json()
    assert other_cat == []

    second = report(client, b, lat=LAT + 0.0003, title="Pothole at Station Road")
    assert second["possible_duplicate_of"] == first["id"]
    assert client.get(f"/issues/{first['id']}").json()["duplicate_count"] == 1


def test_upvote_raises_priority(client):
    a = register(client, "Asha", "a@example.org")
    b = register(client, "Bala", "b@example.org")
    c = register(client, "Chitra", "c@example.org")
    issue = report(client, a)
    before = issue["priority"]["score"]

    assert client.post(f"/issues/{issue['id']}/upvote", headers=a).status_code == 400
    r = client.post(f"/issues/{issue['id']}/upvote", headers=b).json()
    assert r["upvotes"] == 1 and r["upvoted_by_me"] is True
    r = client.post(f"/issues/{issue['id']}/upvote", headers=c).json()
    assert r["priority"]["score"] > before
    r = client.post(f"/issues/{issue['id']}/upvote", headers=c).json()  # toggle off
    assert r["upvotes"] == 1


def test_assignment_and_status_permissions(client):
    asyncio.run(create_users(main.app.state.db))
    citizen = login(client, "citizen@civicfix.app", "citizen123")
    admin = login(client, "admin@civicfix.app", "admin123")
    roads = login(client, "roads@civicfix.app", "team123")
    water = login(client, "water@civicfix.app", "team123")

    issue = report(client, citizen)
    iid = issue["id"]
    assert issue["suggested_team"] == "Roads"

    assert client.patch(f"/issues/{iid}/assign", json={"team": "Roads"}, headers=citizen).status_code == 403
    assert client.patch(f"/issues/{iid}/status", json={"status": "in_progress"}, headers=roads).status_code == 400  # not assigned yet

    r = client.patch(f"/issues/{iid}/assign", json={"team": "Roads"}, headers=admin).json()
    assert r["status"] == "assigned" and r["assigned_team"] == "Roads"

    assert client.patch(f"/issues/{iid}/status", json={"status": "in_progress"}, headers=water).status_code == 403
    assert client.patch(f"/issues/{iid}/status", json={"status": "in_progress"}, headers=roads).status_code == 200
    r = client.patch(f"/issues/{iid}/status", json={"status": "resolved", "note": "Patched"}, headers=roads).json()
    assert r["status"] == "resolved" and r["resolution_hours"] is not None
    assert r["priority"]["label"] == "Closed"
    assert [t["status"] for t in r["timeline"]] == ["reported", "assigned", "in_progress", "resolved"]

    mine = client.get("/issues/mine", headers=citizen).json()
    assert len(mine) == 1

    s = client.get("/stats").json()
    assert s["resolved"] == 1 and s["by_team"]["Roads"]["resolved"] == 1
    assert s["avg_resolution_hours"] is not None


def test_merge_duplicate(client):
    asyncio.run(create_users(main.app.state.db))
    citizen = login(client, "citizen@civicfix.app", "citizen123")
    priya = login(client, "priya@civicfix.app", "citizen123")
    admin = login(client, "admin@civicfix.app", "admin123")

    base = report(client, citizen)
    dup = report(client, priya, lng=LNG + 0.05, title="Road damage")  # far, so not auto-linked
    assert dup["possible_duplicate_of"] is None

    r = client.post(f"/issues/{dup['id']}/merge", json={"duplicate_of": base["id"]}, headers=admin)
    assert r.status_code == 200 and r.json()["status"] == "duplicate"
    assert client.get(f"/issues/{base['id']}").json()["duplicate_count"] == 1
    assert client.post(f"/issues/{base['id']}/merge", json={"duplicate_of": base["id"]}, headers=admin).status_code == 400
    ids = [i["id"] for i in client.get("/issues").json()]
    assert dup["id"] not in ids  # merged issues hidden by default


def test_nearby_filter_and_sort(client):
    a = register(client, "Asha", "a@example.org")
    near = report(client, a, title="Near one", lat=LAT)
    far = report(client, a, title="Far one", category="garbage", lat=LAT + 0.1)

    res = client.get(f"/issues?lat={LAT}&lng={LNG}&radius_km=2&sort=nearest").json()
    assert [i["id"] for i in res] == [near["id"]]
    assert "distance_m" in res[0]
    res = client.get(f"/issues?lat={LAT}&lng={LNG}&radius_km=50").json()
    assert {i["id"] for i in res} == {near["id"], far["id"]}


def test_seed_and_stats(client):
    n = asyncio.run(seed(main.app.state.db))
    assert n >= 40
    login(client, "admin@civicfix.app", "admin123")
    s = client.get("/stats").json()
    assert s["total"] >= 40 and s["resolved"] > 5
    assert s["avg_resolution_hours"] and s["median_resolution_hours"]
    assert len(s["last_14_days"]) == 14
    assert sum(s["open_by_priority"].values()) == s["open"]
    items = client.get("/issues?sort=priority").json()
    scores = [i["priority"]["score"] for i in items]
    assert scores == sorted(scores, reverse=True)
    assert any(i["possible_duplicate_of"] for i in client.get("/issues").json())
    assert len(client.get("/meta").json()["categories"]) == 5


def test_helpers():
    assert text_similarity("Pothole on Station Road", "pothole at station road") > 0.7
    assert text_similarity("Pothole on Station Road", "Garbage near temple") < 0.3
    assert text_similarity("", "anything") == 0.0
    assert priority_label(70) == "Critical" and priority_label(10) == "Low"


def test_banned_user_is_locked_out(client):
    asyncio.run(create_users(main.app.state.db))
    admin = login(client, "admin@civicfix.app", "admin123")
    citizen = login(client, "citizen@civicfix.app", "citizen123")
    users = client.get("/admin/users?search=citizen@civicfix.app", headers=admin).json()["items"]
    uid = users[0]["id"]

    assert client.patch(f"/admin/users/{uid}/ban", json={"banned": True}, headers=admin).status_code == 200
    # existing token stops working immediately, and new logins are refused
    assert client.get("/auth/me", headers=citizen).status_code == 403
    r = client.post("/auth/login", json={"email": "citizen@civicfix.app", "password": "citizen123"})
    assert r.status_code == 403

    client.patch(f"/admin/users/{uid}/ban", json={"banned": False}, headers=admin)
    assert client.get("/auth/me", headers=citizen).status_code == 200


def test_admin_endpoints_require_admin(client):
    asyncio.run(create_users(main.app.state.db))
    citizen = login(client, "citizen@civicfix.app", "citizen123")
    roads = login(client, "roads@civicfix.app", "team123")
    for h in (citizen, roads, {}):
        assert client.get("/admin/overview", headers=h).status_code in (401, 403)
        assert client.get("/admin/users", headers=h).status_code in (401, 403)


def test_admin_notes_delete_and_dismiss(client):
    asyncio.run(create_users(main.app.state.db))
    citizen = login(client, "citizen@civicfix.app", "citizen123")
    priya = login(client, "priya@civicfix.app", "citizen123")
    admin = login(client, "admin@civicfix.app", "admin123")

    a = report(client, citizen)
    b = report(client, priya, lat=LAT + 0.0003, title="Pothole at Station Road")
    assert b["possible_duplicate_of"] == a["id"]
    q = client.get("/admin/duplicates", headers=admin).json()
    assert len(q) == 1 and q[0]["id"] == b["id"]

    r = client.post(f"/admin/issues/{b['id']}/dismiss-duplicate", headers=admin)
    assert r.status_code == 200 and r.json()["possible_duplicate_of"] is None
    assert client.get(f"/issues/{a['id']}").json()["duplicate_count"] == 0

    r = client.post(f"/admin/issues/{a['id']}/note", json={"note": "Inspecting"}, headers=admin)
    assert r.json()["timeline"][-1]["note"] == "Inspecting"

    assert client.delete(f"/admin/issues/{b['id']}", headers=admin).status_code == 204
    assert client.get(f"/issues/{b['id']}").status_code == 404


def test_photo_upload(client):
    a = register(client, "Asha", "a@example.org")
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    assert client.post("/uploads", files={"file": ("x.png", png, "image/png")}).status_code in (401, 403)
    r = client.post("/uploads", files={"file": ("x.png", png, "image/png")}, headers=a)
    assert r.status_code == 201, r.text
    url = r.json()["url"]
    got = client.get("/uploads/" + url.rsplit("/", 1)[1])
    assert got.status_code == 200 and got.headers["content-type"] == "image/png"
    bad = client.post("/uploads", files={"file": ("x.png", b"<script>", "image/png")}, headers=a)
    assert bad.status_code == 400

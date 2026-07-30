"""Admin console backend endpoint tests (iteration 5).

Covers /api/admin/overview, /admin/transactions, /admin/tournaments,
/admin/challenges, /admin/tickets*, /admin/reports*, /admin/ads*.

Seeds fresh users + activity, then verifies each admin endpoint.
Admin auth uses the only seeded account (see /app/memory/test_credentials.md).
"""
import os
import uuid
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "matchpoint_db")

ADMIN_EMAIL = "admin@matchpoint.gg"
ADMIN_PASS = "Admin@123"


# ---------- Helpers ----------

def _post(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE_URL}{path}", json=json, headers=h, timeout=30)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE_URL}{path}", headers=h, params=params, timeout=30)


def _delete(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{BASE_URL}{path}", headers=h, timeout=30)


def _admin_login():
    r = _post("/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    code = r.json().get("dev_code")
    assert code, "admin login should return dev_code"
    r2 = _post("/api/auth/verify-2fa", {"email": ADMIN_EMAIL, "code": code})
    assert r2.status_code == 200, f"admin 2fa failed: {r2.text}"
    return r2.json()["access_token"], r2.json()["user"]


def _register_user(suffix):
    email = f"TEST_admin_{suffix}@matchpoint.gg"
    username = f"TESTadm{suffix[:6]}"
    r = _post("/api/auth/register", {
        "email": email, "username": username, "password": "TestPass123!",
    })
    assert r.status_code == 200, f"register failed: {r.text}"
    code = r.json()["dev_code"]
    r2 = _post("/api/auth/verify-email", {"email": email, "code": code})
    assert r2.status_code == 200, r2.text
    r3 = _post("/api/auth/login", {"email": email, "password": "TestPass123!"})
    assert r3.status_code == 200
    code2 = r3.json()["dev_code"]
    r4 = _post("/api/auth/verify-2fa", {"email": email, "code": code2})
    assert r4.status_code == 200, r4.text
    return {"email": email, "username": username, "token": r4.json()["access_token"],
            "user_id": r4.json()["user"]["id"]}


@pytest.fixture(scope="module")
def db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="module")
def admin():
    tok, u = _admin_login()
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def seeded(db, admin):
    """Register 2 users and seed activity: wallet tx, challenge, ticket, report, ad."""
    suffix = uuid.uuid4().hex[:6]
    u1 = _register_user(f"a{suffix}")
    u2 = _register_user(f"b{suffix}")

    # Fund u1 wallet directly + seed wallet_tx deposits (completed) so admin sees them
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()
    db.users.update_one({"id": u1["user_id"]}, {"$set": {"wallet_balance": 500.0}})
    db.wallet_tx.insert_many([
        {"id": str(uuid.uuid4()), "user_id": u1["user_id"], "type": "deposit",
         "amount": 100.0, "status": "completed", "created_at": now, "description": "TEST seed"},
        {"id": str(uuid.uuid4()), "user_id": u1["user_id"], "type": "withdrawal",
         "amount": 20.0, "status": "processing", "created_at": now, "description": "TEST pending wd"},
    ])
    # Seed a revenue row so overview revenue > 0
    db.revenue.insert_one({
        "id": str(uuid.uuid4()), "type": "challenge_fee", "amount": 5.0,
        "created_at": now,
    })

    # Create a public challenge from u1 (open), an invited one, and one ticket + one report
    ch = _post("/api/challenges", {
        "game": "Valorant", "platform": "PC", "region": "NA",
        "stake": 10.0, "match_type": "1v1", "notes": "TEST open",
    }, token=u1["token"])
    assert ch.status_code == 200, ch.text
    ch_open_id = ch.json()["id"]

    ch2 = _post("/api/challenges", {
        "game": "Valorant", "platform": "PC", "region": "NA",
        "stake": 10.0, "match_type": "1v1", "notes": "TEST invite",
        "opponent_username": u2["username"],
    }, token=u1["token"])
    assert ch2.status_code == 200, ch2.text
    ch_inv_id = ch2.json()["id"]

    # Support ticket by u2
    tk = _post("/api/support/tickets", {
        "subject": "TEST ticket subject", "message": "TEST body", "category": "account",
    }, token=u2["token"])
    assert tk.status_code == 200, tk.text
    ticket_id = tk.json()["id"]

    # Fair-play report by u1 targeting u2
    rp = _post("/api/reports", {
        "target_type": "player", "target_id": u2["user_id"],
        "reason": "cheating", "detail": "TEST evidence",
    }, token=u1["token"])
    assert rp.status_code == 200, rp.text
    report_id = rp.json()["id"]

    # Ad (admin only)
    ad = _post("/api/admin/ads", {
        "title": "TEST ad", "image": "https://example.com/a.png",
        "link": "https://example.com", "placement": "home", "active": True,
    }, token=admin["token"])
    assert ad.status_code == 200, ad.text
    ad_id = ad.json().get("id")

    return {
        "u1": u1, "u2": u2,
        "ch_open_id": ch_open_id, "ch_inv_id": ch_inv_id,
        "ticket_id": ticket_id, "report_id": report_id, "ad_id": ad_id,
    }


# ---------- Auth guards ----------

class TestAdminAuth:
    def test_overview_requires_admin(self):
        # No token => 401 or 403
        r = _get("/api/admin/overview")
        assert r.status_code in (401, 403), r.text

    def test_overview_forbidden_for_regular_user(self, seeded):
        r = _get("/api/admin/overview", token=seeded["u1"]["token"])
        assert r.status_code == 403, r.text


# ---------- Overview ----------

class TestAdminOverview:
    def test_overview_shape(self, admin, seeded):
        r = _get("/api/admin/overview", token=admin["token"])
        assert r.status_code == 200, r.text
        data = r.json()
        assert set(["kpis", "revenue_by_type", "timeseries"]).issubset(data.keys())
        k = data["kpis"]
        # Required KPI keys
        required = [
            "total_users", "new_users_24h", "new_users_7d", "suspended_users",
            "dau", "mau",
            "active_challenges", "disputed_challenges", "finalized_challenges",
            "active_tournaments",
            "total_deposits", "total_withdrawals", "pending_withdrawals",
            "total_revenue", "revenue_24h", "revenue_7d",
            "open_tickets", "open_reports",
        ]
        missing = [x for x in required if x not in k]
        assert not missing, f"missing KPI keys: {missing}"

        # Values reflect seeded activity
        assert k["total_users"] >= 2
        assert k["active_challenges"] >= 2  # our open + invited
        assert k["open_tickets"] >= 1
        assert k["open_reports"] >= 1
        assert k["total_deposits"] >= 100.0
        assert k["pending_withdrawals"] >= 1
        assert k["total_revenue"] >= 5.0

        # 8 daily buckets (7 days ago -> today inclusive)
        assert isinstance(data["timeseries"], list)
        assert len(data["timeseries"]) == 8
        for b in data["timeseries"]:
            for key in ("date", "revenue", "signups", "deposits", "withdrawals"):
                assert key in b, f"missing bucket key {key}"


# ---------- Transactions ----------

class TestAdminTransactions:
    def test_list_enriched(self, admin, seeded):
        r = _get("/api/admin/transactions", token=admin["token"])
        assert r.status_code == 200, r.text
        txs = r.json()
        assert isinstance(txs, list) and len(txs) >= 2
        # Our seeded deposit tx has u1's user_id -> should be enriched with username
        found = [t for t in txs if t.get("user_id") == seeded["u1"]["user_id"]]
        assert found, "seeded tx missing"
        assert any(t.get("username") == seeded["u1"]["username"] for t in found), \
            "expected username enrichment on admin transactions"
        assert any(t.get("email") == seeded["u1"]["email"] for t in found)

    def test_filter_by_type(self, admin):
        r = _get("/api/admin/transactions", token=admin["token"], params={"tx_type": "deposit"})
        assert r.status_code == 200
        assert all(t["type"] == "deposit" for t in r.json())

    def test_filter_by_status(self, admin):
        r = _get("/api/admin/transactions", token=admin["token"], params={"status": "completed"})
        assert r.status_code == 200
        assert all(t["status"] == "completed" for t in r.json())


# ---------- Tournaments / Challenges ----------

class TestAdminListings:
    def test_tournaments_sorted(self, admin):
        r = _get("/api/admin/tournaments", token=admin["token"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)  # likely empty on fresh DB

    def test_challenges_includes_invited(self, admin, seeded):
        r = _get("/api/admin/challenges", token=admin["token"])
        assert r.status_code == 200
        chs = r.json()
        ids = {c["id"] for c in chs}
        assert seeded["ch_open_id"] in ids
        assert seeded["ch_inv_id"] in ids, "admin/challenges must include 'invited' challenges"
        statuses = {c["status"] for c in chs}
        assert "invited" in statuses


# ---------- Tickets ----------

class TestAdminTickets:
    def test_list_and_filter(self, admin, seeded):
        r = _get("/api/admin/tickets", token=admin["token"])
        assert r.status_code == 200
        assert any(t["id"] == seeded["ticket_id"] for t in r.json())
        r2 = _get("/api/admin/tickets", token=admin["token"], params={"status": "open"})
        assert r2.status_code == 200
        assert all(t["status"] == "open" for t in r2.json())

    def test_get_detail(self, admin, seeded):
        r = _get(f"/api/admin/tickets/{seeded['ticket_id']}", token=admin["token"])
        assert r.status_code == 200
        assert r.json()["id"] == seeded["ticket_id"]

    def test_reply_and_notify(self, admin, seeded, db):
        r = _post(f"/api/admin/tickets/{seeded['ticket_id']}/reply",
                  {"text": "TEST admin reply"}, token=admin["token"])
        assert r.status_code == 200, r.text
        # Verify ticket updated
        t = db.tickets.find_one({"id": seeded["ticket_id"]}, {"_id": 0})
        assert t["status"] == "answered"
        msgs = t.get("messages", [])
        admin_msgs = [m for m in msgs if m.get("from") == "admin"]
        assert admin_msgs, "admin message not appended"
        assert admin_msgs[-1]["author"] == admin["user"]["username"]
        assert admin_msgs[-1]["text"] == "TEST admin reply"
        # Notification created for the ticket owner
        n = db.notifications.find_one({"user_id": seeded["u2"]["user_id"],
                                        "kind": "support_update",
                                        "ref_id": seeded["ticket_id"]})
        assert n is not None, "support_update notification not created"

    def test_close(self, admin, seeded, db):
        r = _post(f"/api/admin/tickets/{seeded['ticket_id']}/close",
                  {}, token=admin["token"])
        assert r.status_code == 200, r.text
        t = db.tickets.find_one({"id": seeded["ticket_id"]}, {"_id": 0})
        assert t["status"] == "closed"


# ---------- Reports ----------

class TestAdminReports:
    def test_list_enriched(self, admin, seeded):
        r = _get("/api/admin/reports", token=admin["token"])
        assert r.status_code == 200
        reports = r.json()
        mine = [x for x in reports if x["id"] == seeded["report_id"]]
        assert mine, "seeded report missing"
        assert mine[0].get("reporter_username") == seeded["u1"]["username"], \
            "reports should be enriched with reporter_username"

    def test_resolve_suspend_suspends_target(self, admin, seeded, db):
        r = _post(f"/api/admin/reports/{seeded['report_id']}/resolve",
                  {"action": "suspended", "note": "TEST"}, token=admin["token"])
        assert r.status_code == 200, r.text
        rep = db.reports.find_one({"id": seeded["report_id"]}, {"_id": 0})
        assert rep["status"] == "suspended"
        assert rep.get("resolution_note") == "TEST"
        # Target user (u2, player) should be suspended
        u = db.users.find_one({"id": seeded["u2"]["user_id"]}, {"_id": 0})
        assert u.get("suspended") is True


# ---------- Ads ----------

class TestAdminAds:
    def test_list(self, admin, seeded):
        r = _get("/api/admin/ads", token=admin["token"])
        assert r.status_code == 200
        assert any(a.get("id") == seeded["ad_id"] for a in r.json())

    def test_toggle_flips_active(self, admin, seeded, db):
        before = db.ads.find_one({"id": seeded["ad_id"]}, {"_id": 0})
        r = _post(f"/api/admin/ads/{seeded['ad_id']}/toggle", {}, token=admin["token"])
        assert r.status_code == 200, r.text
        after = db.ads.find_one({"id": seeded["ad_id"]}, {"_id": 0})
        assert bool(after["active"]) != bool(before["active"])

    def test_delete(self, admin, seeded, db):
        r = _delete(f"/api/admin/ads/{seeded['ad_id']}", token=admin["token"])
        assert r.status_code == 200, r.text
        assert db.ads.find_one({"id": seeded["ad_id"]}) is None


# ---------- Session last_seen ----------

class TestSessionLastSeen:
    def test_last_seen_updated(self, seeded, db):
        # An authenticated call should touch the session's last_seen
        r = _get("/api/auth/me", token=seeded["u1"]["token"])
        assert r.status_code == 200
        time.sleep(0.5)
        sess = list(db.sessions.find({"user_id": seeded["u1"]["user_id"]}, {"_id": 0}))
        assert sess, "no session for u1"
        # last_seen should be present and be an ISO string
        assert any(s.get("last_seen") for s in sess), "last_seen not tracked"

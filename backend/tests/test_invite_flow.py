"""
Iteration 4: 1v1 invite-by-username flow + no-seed-data verification.
Tests:
  - POST /api/challenges with opponent_username (404 nonexistent, 400 self, success)
  - Private invite hidden from public /challenges list
  - GET /api/challenges?invites=true returns invites for current user
  - accept: 403 wrong user; success invited opponent
  - decline: 403 non-invited; success -> refund creator + notification
  - cancel invited challenge -> refund + notify opponent
  - GET /api/users/search prefix behavior
  - No seed data: admin only, no demo, no tournaments
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://matchpoint-play.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# MongoDB direct access to seed wallet balances
from pymongo import MongoClient
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _post(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json or {}, headers=h, timeout=30)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=30)


def _login_2fa(email, password):
    r = _post("/auth/login", {"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.text}"
    d = r.json()
    if d.get("require_2fa"):
        code = d.get("dev_code")
        r2 = _post("/auth/verify-2fa", {"email": email, "code": code})
        assert r2.status_code == 200, f"verify-2fa failed: {r2.text}"
        d2 = r2.json()
        return d2["access_token"], d2["user"]
    return d["access_token"], d["user"]


def _make_user(prefix="inv"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@matchpoint.gg"
    username = f"TEST{prefix}{uuid.uuid4().hex[:6]}"
    password = "Test@1234"
    r = _post("/auth/register", {"email": email, "password": password, "username": username})
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    v = _post("/auth/verify-email", {"email": email, "code": code})
    assert v.status_code == 200, v.text
    tok, user = _login_2fa(email, password)
    return {"email": email, "username": username, "password": password, "token": tok, "user": user}


def _fund_user(email, amount):
    _db.users.update_one({"email": email}, {"$set": {"wallet_balance": amount}})


# ============================================================
# NO SEED DATA
# ============================================================
class TestNoSeedData:
    def test_admin_user_seeded(self):
        r = _post("/auth/login", {"email": "admin@matchpoint.gg", "password": "Admin@123"})
        assert r.status_code == 200, r.text

    def test_demo_user_removed(self):
        r = _post("/auth/login", {"email": "demo@matchpoint.gg", "password": "Demo@123"})
        assert r.status_code in (400, 401, 403, 404), f"demo user should not exist, got {r.status_code}"

    def test_tournaments_empty_or_no_seed_named(self):
        # public list should have no seeded sample tournaments (like "Weekly Cup")
        r = _get("/tournaments")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        for t in arr:
            assert "Sample" not in t.get("name", "") and "Weekly Cup" not in t.get("name", ""), \
                f"seed data leaked: {t.get('name')}"


# ============================================================
# USER SEARCH
# ============================================================
class TestUserSearch:
    def test_empty_query_returns_empty(self):
        u = _make_user("srch1")
        r = _get("/users/search", token=u["token"], params={"q": ""})
        assert r.status_code == 200
        assert r.json() == []

    def test_prefix_search_returns_matches_excludes_self_and_admin(self):
        # Create two users with a common prefix
        prefix = uuid.uuid4().hex[:6]
        u_a = _make_user(f"pfx{prefix}a")  # will have username with 'TESTpfx{prefix}a...'
        u_b = _make_user(f"pfx{prefix}b")
        # Search from u_a for common substring — actual prefix is 'TESTpfx' + prefix
        query = f"TESTpfx{prefix}"
        r = _get("/users/search", token=u_a["token"], params={"q": query})
        assert r.status_code == 200, r.text
        arr = r.json()
        usernames = [x.get("username") for x in arr]
        # Should include u_b, exclude self (u_a) and admin
        assert u_b["username"] in usernames, f"expected {u_b['username']} in {usernames}"
        assert u_a["username"] not in usernames, f"self should be excluded, got {usernames}"
        for x in arr:
            assert x.get("username") != "admin"


# ============================================================
# INVITE FLOW
# ============================================================
class TestInviteFlow:
    def test_invite_nonexistent_user_404(self):
        u = _make_user("invNE")
        _fund_user(u["email"], 100.0)
        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 10.0, "region": "GLOBAL",
            "opponent_username": f"nobody_{uuid.uuid4().hex[:8]}"
        }, token=u["token"])
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_invite_self_400(self):
        u = _make_user("invSelf")
        _fund_user(u["email"], 100.0)
        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 10.0, "region": "GLOBAL",
            "opponent_username": u["username"]
        }, token=u["token"])
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_invite_success_deducts_creator_stake_and_notifies_opponent(self):
        creator = _make_user("invC")
        opp = _make_user("invO")
        _fund_user(creator["email"], 100.0)
        # Verify balance in DB
        creator_doc = _db.users.find_one({"email": creator["email"]})
        assert creator_doc["wallet_balance"] == 100.0

        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 25.0, "region": "GLOBAL",
            "opponent_username": opp["username"]
        }, token=creator["token"])
        assert r.status_code == 200, r.text
        ch = r.json()
        assert ch.get("status") == "invited", f"expected status='invited', got {ch.get('status')}"
        assert ch.get("opponent_id") == opp["user"]["id"], f"opponent_id mismatch"

        # Creator balance: 100 - 25 = 75, pending = 25
        c2 = _db.users.find_one({"email": creator["email"]})
        assert abs(c2["wallet_balance"] - 75.0) < 0.01, f"wallet_balance={c2['wallet_balance']}"
        assert abs(c2.get("pending_balance", 0.0) - 25.0) < 0.01, f"pending_balance={c2.get('pending_balance')}"

        # Notification for opponent
        notifs = _get("/notifications", token=opp["token"]).json()
        invite_notifs = [n for n in notifs if n.get("kind") == "challenge_invite"]
        assert invite_notifs, f"no challenge_invite notif; got {notifs}"
        n0 = invite_notifs[0]
        assert n0.get("category") == "challenge"
        assert n0.get("ref_id") == ch["id"]

        # Store for other tests via pytest cache is complex; return the fixture-like dict for chained use
        return {"creator": creator, "opp": opp, "challenge_id": ch["id"]}

    def test_invite_privacy_and_invites_filter_and_decline(self):
        # Setup
        creator = _make_user("privC")
        opp = _make_user("privO")
        third = _make_user("priv3")
        _fund_user(creator["email"], 100.0)
        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 20.0, "region": "GLOBAL",
            "opponent_username": opp["username"]
        }, token=creator["token"])
        assert r.status_code == 200, r.text
        ch_id = r.json()["id"]

        # 1) Third user's GET /challenges should NOT include this invited challenge
        lst_third = _get("/challenges", token=third["token"]).json()
        ids_third = [c["id"] for c in lst_third]
        assert ch_id not in ids_third, f"invited challenge leaked to third-party list"

        # 2) Opponent's GET /challenges?invites=true SHOULD return it
        inv = _get("/challenges", token=opp["token"], params={"invites": "true"}).json()
        inv_ids = [c["id"] for c in inv]
        assert ch_id in inv_ids, f"opponent invites list missing challenge; got {inv_ids}"

        # 3) Third user tries to accept -> 403
        acc_bad = _post(f"/challenges/{ch_id}/accept", token=third["token"])
        assert acc_bad.status_code == 403, f"expected 403, got {acc_bad.status_code}: {acc_bad.text}"

        # 4) Third user tries to decline -> 403
        dec_bad = _post(f"/challenges/{ch_id}/decline", token=third["token"])
        assert dec_bad.status_code == 403, f"expected 403, got {dec_bad.status_code}: {dec_bad.text}"

        # 5) Opponent declines -> success
        dec = _post(f"/challenges/{ch_id}/decline", token=opp["token"])
        assert dec.status_code == 200, dec.text
        det = _get(f"/challenges/{ch_id}", token=opp["token"]).json()
        assert det["status"] == "declined", f"expected declined, got {det.get('status')}"

        # 6) Creator's stake refunded: 100 back, 0 pending
        c2 = _db.users.find_one({"email": creator["email"]})
        assert abs(c2["wallet_balance"] - 100.0) < 0.01, f"expected 100 refund, got {c2['wallet_balance']}"
        assert abs(c2.get("pending_balance", 0.0)) < 0.01, f"pending should be 0, got {c2.get('pending_balance')}"

        # 7) Creator got 'challenge_declined' notification
        notifs = _get("/notifications", token=creator["token"]).json()
        assert any(n.get("kind") == "challenge_declined" and n.get("ref_id") == ch_id for n in notifs), \
            f"no challenge_declined notif; got kinds {[n.get('kind') for n in notifs]}"

    def test_invite_accept_by_invited_opponent(self):
        creator = _make_user("accC")
        opp = _make_user("accO")
        _fund_user(creator["email"], 100.0)
        _fund_user(opp["email"], 100.0)
        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 30.0, "region": "GLOBAL",
            "opponent_username": opp["username"]
        }, token=creator["token"])
        assert r.status_code == 200, r.text
        ch_id = r.json()["id"]

        acc = _post(f"/challenges/{ch_id}/accept", token=opp["token"])
        assert acc.status_code == 200, acc.text
        det = _get(f"/challenges/{ch_id}", token=opp["token"]).json()
        assert det["status"] in ("matched", "accepted", "ready"), f"expected matched-like, got {det['status']}"

        # opp's stake locked: balance 70, pending 30
        o2 = _db.users.find_one({"email": opp["email"]})
        assert abs(o2["wallet_balance"] - 70.0) < 0.01, f"opp balance={o2['wallet_balance']}"

    def test_invite_creator_cancels_refunds_and_notifies(self):
        creator = _make_user("canC")
        opp = _make_user("canO")
        _fund_user(creator["email"], 100.0)
        r = _post("/challenges", {
            "game": "FIFA 25", "platform": "PC", "stake": 15.0, "region": "GLOBAL",
            "opponent_username": opp["username"]
        }, token=creator["token"])
        assert r.status_code == 200, r.text
        ch_id = r.json()["id"]

        cn = _post(f"/challenges/{ch_id}/cancel", token=creator["token"])
        assert cn.status_code == 200, cn.text
        det = _get(f"/challenges/{ch_id}", token=creator["token"]).json()
        assert det["status"] in ("cancelled", "canceled"), f"got status={det['status']}"

        # Creator refunded
        c2 = _db.users.find_one({"email": creator["email"]})
        assert abs(c2["wallet_balance"] - 100.0) < 0.01, f"balance={c2['wallet_balance']}"

        # Opponent notified
        notifs = _get("/notifications", token=opp["token"]).json()
        assert any(n.get("kind") == "challenge_invite_cancelled" and n.get("ref_id") == ch_id for n in notifs), \
            f"no cancel notif; got {[n.get('kind') for n in notifs]}"


# ============================================================
# ADMIN LOGIN SANITY
# ============================================================
class TestAdminSeed:
    def test_admin_login_and_me(self):
        tok, user = _login_2fa("admin@matchpoint.gg", "Admin@123")
        r = _get("/auth/me", token=tok)
        assert r.status_code == 200
        assert r.json().get("email") == "admin@matchpoint.gg"

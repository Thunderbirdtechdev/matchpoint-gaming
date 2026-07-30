"""Iteration 6 backend tests.

Covers:
  1. require_player dependency: admin token rejected (403) on all player-facing
     endpoints (wallet, challenges, tournaments) while regular players and
     read-only routes still work for the admin.
  2. 1v1 report flow: creator_reported_winner_id / opponent_reported_winner_id
     columns, waiting → settled (agree) and waiting → disputed (disagree),
     escrow lock on dispute, disputes collection insert + close on
     /admin/disputes/{id}/resolve.
"""
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "matchpoint_db")

ADMIN_EMAIL = "admin@matchpoint.gg"
ADMIN_PASS = "Admin@123"

BLOCKED_MSG = "Admin accounts cannot participate as players"


# ---------- Helpers ----------
def _hdr(token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _post(path, json=None, token=None):
    return requests.post(f"{BASE_URL}{path}", json=json, headers=_hdr(token), timeout=30)


def _get(path, token=None, params=None):
    return requests.get(f"{BASE_URL}{path}", headers=_hdr(token), params=params, timeout=30)


def _admin_login():
    r = _post("/api/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r2 = _post("/api/auth/verify-2fa", {"email": ADMIN_EMAIL, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()["access_token"], r2.json()["user"]


def _register_user(suffix):
    email = f"TEST_disp_{suffix}@matchpoint.gg"
    username = f"TESTdsp{suffix[:6]}"
    r = _post("/api/auth/register", {
        "email": email, "username": username, "password": "TestPass123!",
    })
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r2 = _post("/api/auth/verify-email", {"email": email, "code": code})
    assert r2.status_code == 200
    r3 = _post("/api/auth/login", {"email": email, "password": "TestPass123!"})
    assert r3.status_code == 200
    code2 = r3.json()["dev_code"]
    r4 = _post("/api/auth/verify-2fa", {"email": email, "code": code2})
    assert r4.status_code == 200, r4.text
    return {"email": email, "username": username,
            "token": r4.json()["access_token"], "user_id": r4.json()["user"]["id"]}


@pytest.fixture(scope="module")
def db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="module")
def admin():
    tok, u = _admin_login()
    return {"token": tok, "user": u}


@pytest.fixture(scope="module")
def player(db):
    """A regular player used to validate that same endpoints still work."""
    u = _register_user(uuid.uuid4().hex[:6])
    db.users.update_one({"id": u["user_id"]}, {"$set": {"wallet_balance": 200.0}})
    return u


# ============================================================
# 1. Admin blocked on player-facing endpoints (require_player)
# ============================================================

class TestAdminBlockedOnPlayerEndpoints:
    """Every listed endpoint MUST return 403 with the standard message
    when called with the admin token."""

    def _assert_blocked(self, r):
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert BLOCKED_MSG in r.text, f"unexpected error message: {r.text}"

    def test_wallet_deposit_blocked(self, admin):
        r = _post("/api/wallet/deposit", {"amount": 10}, token=admin["token"])
        self._assert_blocked(r)

    def test_wallet_deposit_status_blocked(self, admin):
        r = _get("/api/wallet/deposit/status/does-not-matter", token=admin["token"])
        self._assert_blocked(r)

    def test_wallet_withdraw_blocked(self, admin):
        r = _post("/api/wallet/withdraw", {"amount": 5, "method": "paypal", "destination": "x@y.z"},
                  token=admin["token"])
        self._assert_blocked(r)

    def test_challenges_create_blocked(self, admin):
        r = _post("/api/challenges", {"game": "Valorant", "platform": "PC",
                                       "region": "NA", "stake": 5.0, "match_type": "1v1"},
                  token=admin["token"])
        self._assert_blocked(r)

    def test_challenges_accept_blocked(self, admin):
        r = _post("/api/challenges/fake-id/accept", {}, token=admin["token"])
        self._assert_blocked(r)

    def test_challenges_decline_blocked(self, admin):
        r = _post("/api/challenges/fake-id/decline", {}, token=admin["token"])
        self._assert_blocked(r)

    def test_challenges_cancel_blocked(self, admin):
        r = _post("/api/challenges/fake-id/cancel", {}, token=admin["token"])
        self._assert_blocked(r)

    def test_challenges_report_blocked(self, admin):
        r = _post("/api/challenges/fake-id/report", {"winner_id": "me"}, token=admin["token"])
        self._assert_blocked(r)

    def test_tournaments_create_blocked(self, admin):
        r = _post("/api/tournaments", {"name": "T", "game": "Valorant",
                                        "platform": "PC", "region": "NA",
                                        "entry_fee": 5, "tournament_type": "single_elim",
                                        "match_type": "1v1", "max_participants": 4},
                  token=admin["token"])
        self._assert_blocked(r)

    def test_tournaments_register_blocked(self, admin):
        r = _post("/api/tournaments/fake-id/register", {}, token=admin["token"])
        self._assert_blocked(r)

    def test_tournaments_start_blocked(self, admin):
        r = _post("/api/tournaments/fake-id/start", {}, token=admin["token"])
        self._assert_blocked(r)

    def test_tournaments_report_blocked(self, admin):
        r = _post("/api/tournaments/fake-id/report",
                  {"match_id": "m", "winner_id": "w"},
                  token=admin["token"])
        self._assert_blocked(r)


# ============================================================
# 2. Admin STILL allowed on read-only / admin routes
# ============================================================

class TestAdminReadOnlyStillWorks:
    def test_auth_me(self, admin):
        r = _get("/api/auth/me", token=admin["token"])
        assert r.status_code == 200
        assert r.json().get("is_admin") is True

    def test_wallet_balance_view(self, admin):
        r = _get("/api/wallet", token=admin["token"])
        assert r.status_code == 200, r.text
        j = r.json()
        # /api/wallet returns {balance, pending, available, earnings}
        assert "balance" in j and "available" in j, j

    def test_notifications_view(self, admin):
        r = _get("/api/notifications", token=admin["token"])
        assert r.status_code == 200

    def test_tournaments_list(self, admin):
        r = _get("/api/tournaments", token=admin["token"])
        assert r.status_code == 200

    def test_challenges_list(self, admin):
        r = _get("/api/challenges", token=admin["token"])
        assert r.status_code == 200

    def test_admin_overview_allowed(self, admin):
        r = _get("/api/admin/overview", token=admin["token"])
        assert r.status_code == 200


# ============================================================
# 3. Regular player endpoints still work
# ============================================================

class TestPlayerEndpointsStillWork:
    def test_player_can_create_challenge(self, player):
        r = _post("/api/challenges", {"game": "Valorant", "platform": "PC",
                                       "region": "NA", "stake": 5.0,
                                       "match_type": "1v1", "notes": "TEST"},
                  token=player["token"])
        assert r.status_code == 200, r.text
        assert r.json()["creator_id"] == player["user_id"]


# ============================================================
# 4. Report flow: waiting → settled (both agree)
# ============================================================

def _fund_and_pair(db):
    """Register two players, fund them, create + accept a challenge. Return dict."""
    a = _register_user(uuid.uuid4().hex[:6])
    b = _register_user(uuid.uuid4().hex[:6])
    db.users.update_one({"id": a["user_id"]}, {"$set": {"wallet_balance": 100.0}})
    db.users.update_one({"id": b["user_id"]}, {"$set": {"wallet_balance": 100.0}})
    ch = _post("/api/challenges", {"game": "Valorant", "platform": "PC",
                                    "region": "NA", "stake": 20.0,
                                    "match_type": "1v1", "notes": "TEST"},
               token=a["token"])
    assert ch.status_code == 200, ch.text
    ch_id = ch.json()["id"]
    acc = _post(f"/api/challenges/{ch_id}/accept", {}, token=b["token"])
    assert acc.status_code == 200, acc.text
    return {"a": a, "b": b, "ch_id": ch_id, "stake": 20.0}


class TestReportSettled:
    @pytest.fixture(scope="class")
    def paired(self, db):
        return _fund_and_pair(db)

    def test_first_report_returns_waiting(self, paired, db):
        # creator reports themselves as winner
        r = _post(f"/api/challenges/{paired['ch_id']}/report",
                  {"winner_id": "me"}, token=paired["a"]["token"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "waiting", j
        ch = db.challenges.find_one({"id": paired["ch_id"]}, {"_id": 0})
        assert ch["creator_reported_winner_id"] == paired["a"]["user_id"]
        assert ch.get("opponent_reported_winner_id") in (None, "")
        assert ch["status"] == "reported"

    def test_agreeing_second_report_settles(self, paired, db):
        # opponent reports the SAME winner (creator) => auto-settle
        r = _post(f"/api/challenges/{paired['ch_id']}/report",
                  {"winner_id": paired["a"]["user_id"]},
                  token=paired["b"]["token"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "settled"
        assert j["winner_id"] == paired["a"]["user_id"]

        ch = db.challenges.find_one({"id": paired["ch_id"]}, {"_id": 0})
        assert ch["status"] == "finalized"
        assert ch["winner_id"] == paired["a"]["user_id"]
        assert ch["opponent_reported_winner_id"] == paired["a"]["user_id"]
        # Winner paid out (net of fee).
        winner = db.users.find_one({"id": paired["a"]["user_id"]}, {"_id": 0})
        # Winner should now have their stake back + net prize credited.
        assert winner["wallet_balance"] > 80.0, winner["wallet_balance"]
        # Pending balance released
        assert (winner.get("pending_balance") or 0) == 0
        loser = db.users.find_one({"id": paired["b"]["user_id"]}, {"_id": 0})
        assert (loser.get("pending_balance") or 0) == 0


# ============================================================
# 5. Report flow: waiting → disputed + admin resolve
# ============================================================

class TestReportDisputed:
    @pytest.fixture(scope="class")
    def paired(self, db):
        return _fund_and_pair(db)

    def test_disagreement_creates_dispute(self, paired, db):
        # A reports A as winner
        r1 = _post(f"/api/challenges/{paired['ch_id']}/report",
                   {"winner_id": paired["a"]["user_id"]}, token=paired["a"]["token"])
        assert r1.status_code == 200
        assert r1.json()["status"] == "waiting"

        # B reports B as winner (disagreement)
        r2 = _post(f"/api/challenges/{paired['ch_id']}/report",
                   {"winner_id": paired["b"]["user_id"]}, token=paired["b"]["token"])
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "disputed"

        ch = db.challenges.find_one({"id": paired["ch_id"]}, {"_id": 0})
        assert ch["status"] == "disputed"
        assert ch["creator_reported_winner_id"] == paired["a"]["user_id"]
        assert ch["opponent_reported_winner_id"] == paired["b"]["user_id"]

        # A dispute row was inserted, status=open
        d = db.disputes.find_one({"challenge_id": paired["ch_id"]}, {"_id": 0})
        assert d is not None, "dispute row was not created"
        assert d["status"] == "open"
        assert d["opened_by"] == paired["b"]["user_id"]  # B was second reporter

        # Both users notified with support_update
        for uid_ in (paired["a"]["user_id"], paired["b"]["user_id"]):
            n = db.notifications.find_one({"user_id": uid_, "kind": "support_update",
                                            "ref_id": paired["ch_id"]})
            assert n is not None, f"support_update missing for {uid_}"

    def test_funds_locked_after_dispute(self, paired, db):
        """Escrow still held: pending_balance == stake for both, wallet_balance
        not credited to either from this challenge."""
        for u in (paired["a"], paired["b"]):
            doc = db.users.find_one({"id": u["user_id"]}, {"_id": 0})
            assert (doc.get("pending_balance") or 0) == paired["stake"], \
                f"expected pending_balance={paired['stake']} still held for {u['username']}"
            # wallet_balance should NOT include any prize payout yet
            assert doc["wallet_balance"] <= 100.0 - paired["stake"] + 0.01, \
                f"wallet_balance unexpectedly credited to {u['username']}"

    def test_admin_resolve_dispute_finalizes_and_closes_row(self, paired, db, admin):
        # Admin picks A as winner
        r = _post(f"/api/admin/disputes/{paired['ch_id']}/resolve",
                  {"winner_id": paired["a"]["user_id"], "resolution_note": "TEST admin verdict"},
                  token=admin["token"])
        assert r.status_code == 200, r.text
        # Challenge finalized
        ch = db.challenges.find_one({"id": paired["ch_id"]}, {"_id": 0})
        assert ch["status"] == "finalized"
        assert ch["winner_id"] == paired["a"]["user_id"]
        # Dispute row closed
        d = db.disputes.find_one({"challenge_id": paired["ch_id"]}, {"_id": 0})
        assert d is not None
        assert d["status"] == "resolved"
        assert d.get("resolved_by") == admin["user"]["username"]
        assert "resolution" in d and d["resolution"]
        # Winner credited (net of fee)
        winner = db.users.find_one({"id": paired["a"]["user_id"]}, {"_id": 0})
        assert winner["wallet_balance"] > 80.0
        # Both pending balances released
        for u in (paired["a"], paired["b"]):
            doc = db.users.find_one({"id": u["user_id"]}, {"_id": 0})
            assert (doc.get("pending_balance") or 0) == 0

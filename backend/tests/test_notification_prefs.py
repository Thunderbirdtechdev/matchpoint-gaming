"""
Iteration 7 — Notification email preferences + event emails/in-app coverage.
Backend REST tests only (no email delivery verification — Resend blocks fake
recipients with 422; we just confirm 200s and in-app notification rows).

Covered:
  * Fresh-player registration -> verify-email -> login -> verify-2fa (dev_code)
  * GET  /api/notifications/preferences returns 5 defaults (all True)
  * PATCH partial update persists (single key + multi-key) and other keys untouched
  * challenge_invite in-app notification for invited opponent
  * match_starting in-app notification for creator when opponent accepts
  * support_update (dispute) in-app notification for BOTH players on winner-disagreement
  * Email opt-out (email_invites=False) still inserts in-app row for the recipient
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://matchpoint-play.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

# Direct Mongo access — fund test wallets without going through LIVE Stripe.
from pymongo import MongoClient  # noqa: E402

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "matchpoint_db")
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]

EXPECTED_PREF_KEYS = {
    "email_invites",
    "email_matches",
    "email_prize",
    "email_wallet",
    "email_disputes",
}


# --------------------------- helpers --------------------------- #
def _post(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json or {}, headers=h, timeout=30)


def _patch(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.patch(f"{API}{path}", json=json or {}, headers=h, timeout=30)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=30)


def _login_2fa(email, password):
    r = _post("/auth/login", {"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    d = r.json()
    if d.get("require_2fa"):
        code = d.get("dev_code")
        assert code, f"dev_code missing on login response: {d}"
        r2 = _post("/auth/verify-2fa", {"email": email, "code": code})
        assert r2.status_code == 200, f"verify-2fa failed: {r2.text}"
        d2 = r2.json()
        return d2["access_token"], d2["user"]
    return d["access_token"], d["user"]


def _make_user(prefix="np"):
    email = f"TEST_{prefix}_{uuid.uuid4().hex[:8]}@matchpoint.gg"
    username = f"TESTnp{prefix}{uuid.uuid4().hex[:5]}"
    password = "Test@1234"
    r = _post("/auth/register", {"email": email, "password": password, "username": username})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    code = r.json().get("dev_code")
    assert code, f"dev_code missing on register response: {r.json()}"
    v = _post("/auth/verify-email", {"email": email, "code": code})
    assert v.status_code == 200, f"verify-email failed: {v.text}"
    tok, user = _login_2fa(email, password)
    return {"email": email, "username": username, "password": password, "token": tok, "user": user}


def _fund_user(email, amount):
    _db.users.update_one({"email": email}, {"$set": {"wallet_balance": amount, "pending_balance": 0.0}})


# --------------------------- tests --------------------------- #
class TestNotificationPrefsEndpoints:
    def test_get_defaults_all_true(self):
        u = _make_user("pref1")
        r = _get("/notifications/preferences", token=u["token"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert set(body.keys()) >= EXPECTED_PREF_KEYS, f"missing keys: {EXPECTED_PREF_KEYS - set(body.keys())}"
        for k in EXPECTED_PREF_KEYS:
            assert body[k] is True, f"{k} default should be True, got {body[k]}"

    def test_patch_single_key_persists(self):
        u = _make_user("pref2")
        r = _patch("/notifications/preferences", {"email_invites": False}, token=u["token"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email_invites"] is False
        # Other keys still True
        for k in EXPECTED_PREF_KEYS - {"email_invites"}:
            assert body[k] is True, f"{k} unexpectedly changed to {body[k]}"

        # Round-trip persistence via GET
        g = _get("/notifications/preferences", token=u["token"]).json()
        assert g["email_invites"] is False
        for k in EXPECTED_PREF_KEYS - {"email_invites"}:
            assert g[k] is True

    def test_patch_multi_key(self):
        u = _make_user("pref3")
        r = _patch(
            "/notifications/preferences",
            {"email_invites": True, "email_wallet": False},
            token=u["token"],
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email_invites"] is True
        assert body["email_wallet"] is False
        assert body["email_matches"] is True
        assert body["email_prize"] is True
        assert body["email_disputes"] is True

        g = _get("/notifications/preferences", token=u["token"]).json()
        assert g["email_wallet"] is False
        assert g["email_invites"] is True

    def test_patch_flip_back_true(self):
        u = _make_user("pref4")
        # off
        _patch("/notifications/preferences", {"email_disputes": False}, token=u["token"])
        # back on
        r = _patch("/notifications/preferences", {"email_disputes": True}, token=u["token"])
        assert r.status_code == 200
        assert r.json()["email_disputes"] is True

    def test_patch_empty_body_returns_prefs(self):
        u = _make_user("pref5")
        r = _patch("/notifications/preferences", {}, token=u["token"])
        assert r.status_code == 200, r.text
        body = r.json()
        for k in EXPECTED_PREF_KEYS:
            assert body[k] is True

    def test_get_prefs_unauthenticated_401(self):
        r = _get("/notifications/preferences")
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"


class TestEventNotificationsInsertedInApp:
    """
    Full invite → accept → dispute flow, ensuring the in-app notifications
    row is inserted at each event kind, independent of email delivery.
    """

    def test_invite_accept_dispute_end_to_end(self):
        userA = _make_user("A")
        userB = _make_user("B")
        _fund_user(userA["email"], 100.0)
        _fund_user(userB["email"], 100.0)

        # ---- userA invites userB
        r = _post(
            "/challenges",
            {
                "game": "FIFA 25",
                "platform": "PC",
                "stake": 20.0,
                "region": "GLOBAL",
                "opponent_username": userB["username"],
            },
            token=userA["token"],
        )
        assert r.status_code == 200, f"create invite failed: {r.text}"
        ch = r.json()
        ch_id = ch["id"]
        assert ch["status"] == "invited"

        # userB should have a challenge_invite in-app notification
        notifs_b = _get("/notifications", token=userB["token"]).json()
        invite_ns = [n for n in notifs_b if n.get("kind") == "challenge_invite" and n.get("ref_id") == ch_id]
        assert invite_ns, f"challenge_invite notification missing for userB; kinds={[n['kind'] for n in notifs_b]}"

        # ---- userB accepts
        acc = _post(f"/challenges/{ch_id}/accept", token=userB["token"])
        assert acc.status_code == 200, acc.text

        # userA should have a match_starting in-app notification
        notifs_a = _get("/notifications", token=userA["token"]).json()
        match_ns = [n for n in notifs_a if n.get("kind") == "match_starting" and n.get("ref_id") == ch_id]
        assert match_ns, f"match_starting notification missing for userA; kinds={[n['kind'] for n in notifs_a]}"

        # ---- Both report DIFFERENT winners → dispute
        r1 = _post(
            f"/challenges/{ch_id}/report",
            {"winner_id": "me", "my_score": 3, "opponent_score": 1},
            token=userA["token"],
        )
        assert r1.status_code == 200, r1.text
        assert r1.json().get("status") in ("waiting", "reported"), r1.text

        r2 = _post(
            f"/challenges/{ch_id}/report",
            {"winner_id": "me", "my_score": 3, "opponent_score": 2},
            token=userB["token"],
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "disputed", f"expected disputed, got {r2.json()}"

        # Challenge document status
        det = _get(f"/challenges/{ch_id}", token=userA["token"]).json()
        assert det["status"] == "disputed", f"expected challenge.status=disputed, got {det['status']}"

        # BOTH players should now have a support_update dispute notification for this ref_id
        for who, tok in (("A", userA["token"]), ("B", userB["token"])):
            notifs = _get("/notifications", token=tok).json()
            support_ns = [n for n in notifs if n.get("kind") == "support_update" and n.get("ref_id") == ch_id]
            assert support_ns, f"support_update dispute notification missing for user{who}; kinds={[n['kind'] for n in notifs]}"


class TestOptOutStillInsertsInApp:
    """
    When a user has email_invites=False, the invite email should be
    skipped but the in-app notification row MUST still be inserted.
    """

    def test_invite_email_opt_out_keeps_in_app(self):
        userA = _make_user("optA")
        userC = _make_user("optC")
        _fund_user(userA["email"], 100.0)

        # userC opts out of invite emails
        p = _patch("/notifications/preferences", {"email_invites": False}, token=userC["token"])
        assert p.status_code == 200
        assert p.json()["email_invites"] is False

        # userA invites userC
        r = _post(
            "/challenges",
            {
                "game": "FIFA 25",
                "platform": "PC",
                "stake": 10.0,
                "region": "GLOBAL",
                "opponent_username": userC["username"],
            },
            token=userA["token"],
        )
        assert r.status_code == 200, r.text
        ch_id = r.json()["id"]

        # userC's in-app notification MUST still be inserted
        notifs_c = _get("/notifications", token=userC["token"]).json()
        matches = [n for n in notifs_c if n.get("kind") == "challenge_invite" and n.get("ref_id") == ch_id]
        assert matches, (
            f"in-app challenge_invite missing for opted-out user; "
            f"got kinds={[n['kind'] for n in notifs_c]}"
        )


class TestDeclineAndCancelNotifications:
    def test_decline_creates_challenge_declined_notification(self):
        creator = _make_user("dclC")
        opp = _make_user("dclO")
        _fund_user(creator["email"], 100.0)

        r = _post(
            "/challenges",
            {
                "game": "FIFA 25",
                "platform": "PC",
                "stake": 10.0,
                "region": "GLOBAL",
                "opponent_username": opp["username"],
            },
            token=creator["token"],
        )
        assert r.status_code == 200
        ch_id = r.json()["id"]

        dec = _post(f"/challenges/{ch_id}/decline", token=opp["token"])
        assert dec.status_code == 200, dec.text

        notifs = _get("/notifications", token=creator["token"]).json()
        assert any(
            n.get("kind") == "challenge_declined" and n.get("ref_id") == ch_id for n in notifs
        ), f"challenge_declined missing; got kinds={[n['kind'] for n in notifs]}"

    def test_cancel_creates_challenge_invite_cancelled_notification(self):
        creator = _make_user("cnlC")
        opp = _make_user("cnlO")
        _fund_user(creator["email"], 100.0)

        r = _post(
            "/challenges",
            {
                "game": "FIFA 25",
                "platform": "PC",
                "stake": 10.0,
                "region": "GLOBAL",
                "opponent_username": opp["username"],
            },
            token=creator["token"],
        )
        assert r.status_code == 200
        ch_id = r.json()["id"]

        cn = _post(f"/challenges/{ch_id}/cancel", token=creator["token"])
        assert cn.status_code == 200, cn.text

        notifs = _get("/notifications", token=opp["token"]).json()
        assert any(
            n.get("kind") == "challenge_invite_cancelled" and n.get("ref_id") == ch_id for n in notifs
        ), f"challenge_invite_cancelled missing; got kinds={[n['kind'] for n in notifs]}"


class TestPrizePayoutOnAgreement:
    """Both players agree on the winner -> auto-settle -> winner gets prize_payout notif."""

    def test_agreement_auto_settle_prize_payout_notification(self):
        creator = _make_user("przC")
        opp = _make_user("przO")
        _fund_user(creator["email"], 100.0)
        _fund_user(opp["email"], 100.0)

        r = _post(
            "/challenges",
            {
                "game": "FIFA 25",
                "platform": "PC",
                "stake": 20.0,
                "region": "GLOBAL",
                "opponent_username": opp["username"],
            },
            token=creator["token"],
        )
        assert r.status_code == 200, r.text
        ch_id = r.json()["id"]
        creator_id = creator["user"]["id"]

        acc = _post(f"/challenges/{ch_id}/accept", token=opp["token"])
        assert acc.status_code == 200

        # Both report creator as winner
        r1 = _post(
            f"/challenges/{ch_id}/report",
            {"winner_id": "me", "my_score": 3, "opponent_score": 0},
            token=creator["token"],
        )
        assert r1.status_code == 200
        r2 = _post(
            f"/challenges/{ch_id}/report",
            {"winner_id": creator_id, "my_score": 0, "opponent_score": 3},
            token=opp["token"],
        )
        assert r2.status_code == 200, r2.text
        assert r2.json().get("status") == "settled", f"expected settled, got {r2.json()}"

        # Winner receives prize_payout in-app notification
        notifs = _get("/notifications", token=creator["token"]).json()
        assert any(
            n.get("kind") == "prize_payout" and n.get("ref_id") == ch_id for n in notifs
        ), f"prize_payout missing for winner; got kinds={[n['kind'] for n in notifs]}"

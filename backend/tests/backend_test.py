"""
MatchPoint Backend Regression Tests
Covers: auth (register/verify/login/2FA/forgot/reset), wallet (balance/deposit/withdraw/txs),
challenges (create/list/accept/report/finalize/cancel), tournaments, leaderboards,
notifications, support, meta, admin.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://matchpoint-play.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- helpers ----------
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


def _patch(path, json=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.patch(f"{API}{path}", json=json or {}, headers=h, timeout=30)


def _login_2fa(email, password):
    r = _post("/auth/login", {"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data.get("require_2fa") is True
    code = data.get("dev_code")
    assert code, "dev_code missing on login"
    r2 = _post("/auth/verify-2fa", {"email": email, "code": code})
    assert r2.status_code == 200, f"verify-2fa failed: {r2.status_code} {r2.text}"
    d2 = r2.json()
    assert "access_token" in d2 and "user" in d2
    return d2["access_token"], d2["user"]


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def demo_token():
    tok, _ = _login_2fa("demo@matchpoint.gg", "Demo@123")
    return tok


@pytest.fixture(scope="session")
def admin_token():
    tok, _ = _login_2fa("admin@matchpoint.gg", "Admin@123")
    return tok


@pytest.fixture(scope="session")
def second_user():
    """Register + verify a second test user for H2H flow."""
    email = f"TEST_h2h_{uuid.uuid4().hex[:8]}@matchpoint.gg"
    password = "Test@1234"
    username = f"TEST_{uuid.uuid4().hex[:6]}"
    r = _post("/auth/register", {"email": email, "password": password, "username": username})
    assert r.status_code == 200, f"register failed: {r.text}"
    code = r.json().get("dev_code")
    assert code, "register dev_code missing"
    v = _post("/auth/verify-email", {"email": email, "code": code})
    assert v.status_code == 200, f"verify-email failed: {v.text}"
    tok, user = _login_2fa(email, password)
    return {"email": email, "password": password, "token": tok, "user": user}


# ============================================================
# HEALTH & META
# ============================================================
class TestHealthMeta:
    def test_root(self):
        r = _get("/")
        assert r.status_code == 200

    def test_meta_games(self):
        r = _get("/meta/games")
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("games"), list) and len(d["games"]) > 0
        assert "PC" in d.get("platforms", [])

    def test_ads(self):
        r = _get("/ads", params={"placement": "home"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rules_and_faq(self):
        r1 = _get("/rules")
        r2 = _get("/faq")
        assert r1.status_code == 200 and r2.status_code == 200


# ============================================================
# AUTH
# ============================================================
class TestAuth:
    def test_register_verify_flow(self):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@matchpoint.gg"
        r = _post("/auth/register", {"email": email, "password": "Test@1234", "username": f"TEST_{uuid.uuid4().hex[:6]}"})
        assert r.status_code == 200
        code = r.json().get("dev_code")
        assert code and len(code) >= 4
        v = _post("/auth/verify-email", {"email": email, "code": code})
        assert v.status_code == 200

    def test_login_demo_returns_2fa_and_code(self):
        r = _post("/auth/login", {"email": "demo@matchpoint.gg", "password": "Demo@123"})
        assert r.status_code == 200
        d = r.json()
        assert d.get("require_2fa") is True
        assert d.get("dev_code")

    def test_verify_2fa_returns_token(self, demo_token):
        assert demo_token and isinstance(demo_token, str)

    def test_me_endpoint(self, demo_token):
        r = _get("/auth/me", token=demo_token)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == "demo@matchpoint.gg"

    def test_me_unauthenticated(self):
        r = _get("/auth/me")
        assert r.status_code in (401, 403)

    def test_forgot_and_reset_password(self):
        # register a fresh user so we don't clobber demo
        email = f"TEST_fp_{uuid.uuid4().hex[:8]}@matchpoint.gg"
        pw = "Test@1234"
        r = _post("/auth/register", {"email": email, "password": pw, "username": f"TEST_{uuid.uuid4().hex[:6]}"})
        code = r.json()["dev_code"]
        _post("/auth/verify-email", {"email": email, "code": code})
        # forgot
        f = _post("/auth/forgot-password", {"email": email})
        assert f.status_code == 200
        f_code = f.json().get("dev_code")
        assert f_code
        # reset
        newpw = "NewTest@5678"
        rr = _post("/auth/reset-password", {"email": email, "code": f_code, "new_password": newpw})
        assert rr.status_code == 200
        # login with new password
        lg = _post("/auth/login", {"email": email, "password": newpw})
        assert lg.status_code == 200


# ============================================================
# WALLET
# ============================================================
class TestWallet:
    def test_wallet_balance_demo(self, demo_token):
        r = _get("/wallet", token=demo_token)
        assert r.status_code == 200
        d = r.json()
        assert d["balance"] >= 0
        # demo seeded to 500 but tests may have modified; just sanity check
        assert "available" in d and "earnings" in d

    def test_wallet_transactions(self, demo_token):
        r = _get("/wallet/transactions", token=demo_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_deposit_creates_stripe_session(self, demo_token):
        r = _post("/wallet/deposit", {"amount": 25.0}, token=demo_token)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("url", "").startswith("http")
        assert d.get("session_id")

    def test_deposit_status_polling(self, demo_token):
        # Create a session then poll status (unpaid path returns status without crediting)
        cr = _post("/wallet/deposit", {"amount": 10.0}, token=demo_token)
        assert cr.status_code == 200
        sid = cr.json()["session_id"]
        st = _get(f"/wallet/deposit/status/{sid}", token=demo_token)
        assert st.status_code == 200
        assert "payment_status" in st.json() or "status" in st.json()

    def test_withdraw_deducts_and_applies_fee(self, demo_token):
        # baseline
        b0 = _get("/wallet", token=demo_token).json()["balance"]
        amount = 20.0
        # ensure enough balance
        if b0 < amount:
            pytest.skip("insufficient demo balance for withdrawal test")
        r = _post("/wallet/withdraw", {"amount": amount, "bank_account": "****9999"}, token=demo_token)
        assert r.status_code == 200, r.text
        b1 = _get("/wallet", token=demo_token).json()["balance"]
        # exact deduction: full amount
        assert abs((b0 - b1) - amount) < 0.01, f"expected {amount} deducted, got {b0 - b1}"
        # verify a transaction with 2% fee exists
        txs = _get("/wallet/transactions", token=demo_token).json()
        wd = [t for t in txs if t.get("type") in ("withdraw", "withdrawal")]
        assert wd, "no withdraw tx recorded"
        latest = wd[0]
        fee = latest.get("fee", 0)
        # 2% fee
        assert abs(fee - amount * 0.02) < 0.01, f"expected fee {amount*0.02}, got {fee}"


# ============================================================
# CHALLENGES (H2H)
# ============================================================
class TestChallenges:
    def test_create_challenge_requires_balance(self, second_user):
        # new user has 0 balance
        r = _post("/challenges", {"game": "FIFA 25", "platform": "PC", "stake": 50.0, "region": "GLOBAL"},
                  token=second_user["token"])
        assert r.status_code in (400, 402, 403), f"expected rejection, got {r.status_code}"

    def test_full_h2h_flow(self, demo_token, second_user, admin_token):
        # Give second_user some balance via admin? No admin endpoint for that.
        # Use 0-stake challenge instead.
        stake = 0.0
        create = _post("/challenges", {"game": "Call of Duty", "platform": "PC", "stake": stake, "region": "GLOBAL", "notes": "TEST H2H"},
                       token=demo_token)
        assert create.status_code == 200, create.text
        ch = create.json()
        ch_id = ch["id"]
        # list open
        lst = _get("/challenges", token=demo_token, params={"status": "open"})
        assert lst.status_code == 200
        assert any(c["id"] == ch_id for c in lst.json())
        # second user accepts
        acc = _post(f"/challenges/{ch_id}/accept", token=second_user["token"])
        assert acc.status_code == 200, acc.text
        # both report demo as winner
        demo_uid_r = _get("/auth/me", token=demo_token)
        demo_uid = demo_uid_r.json()["id"]
        r1 = _post(f"/challenges/{ch_id}/report", {"winner_id": demo_uid}, token=demo_token)
        assert r1.status_code == 200
        r2 = _post(f"/challenges/{ch_id}/report", {"winner_id": demo_uid}, token=second_user["token"])
        assert r2.status_code == 200
        # verify finalized
        det = _get(f"/challenges/{ch_id}", token=demo_token).json()
        assert det["status"] in ("completed", "settled", "finalized"), f"got status={det.get('status')}"

    def test_create_and_cancel_challenge(self, demo_token):
        cr = _post("/challenges", {"game": "Valorant", "platform": "PC", "stake": 0.0, "region": "GLOBAL"},
                   token=demo_token)
        assert cr.status_code == 200
        ch_id = cr.json()["id"]
        cn = _post(f"/challenges/{ch_id}/cancel", token=demo_token)
        assert cn.status_code == 200
        det = _get(f"/challenges/{ch_id}", token=demo_token).json()
        assert det["status"] in ("cancelled", "canceled")


# ============================================================
# TOURNAMENTS
# ============================================================
class TestTournaments:
    def test_list_tournaments(self):
        r = _get("/tournaments")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_register_start(self, demo_token, second_user):
        payload = {"name": f"TEST Cup {uuid.uuid4().hex[:6]}", "game": "FIFA 25",
                   "platform": "PC", "entry_fee": 0.0, "max_players": 4, "prize_pool": 0}
        cr = _post("/tournaments", payload, token=demo_token)
        assert cr.status_code == 200, cr.text
        t = cr.json()
        tid = t["id"]
        # register demo
        r1 = _post(f"/tournaments/{tid}/register", token=demo_token)
        assert r1.status_code == 200, r1.text
        # register second user
        r2 = _post(f"/tournaments/{tid}/register", token=second_user["token"])
        assert r2.status_code == 200, r2.text
        # start
        s = _post(f"/tournaments/{tid}/start", token=demo_token)
        assert s.status_code == 200, s.text


# ============================================================
# TOURNAMENT MATCH REPORTING E2E (Iteration 2)
# ============================================================
def _make_verified_user():
    email = f"TEST_tm_{uuid.uuid4().hex[:8]}@matchpoint.gg"
    password = "Test@1234"
    username = f"TEST_{uuid.uuid4().hex[:6]}"
    r = _post("/auth/register", {"email": email, "password": password, "username": username})
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    v = _post("/auth/verify-email", {"email": email, "code": code})
    assert v.status_code == 200, v.text
    tok, user = _login_2fa(email, password)
    return {"token": tok, "user": user, "email": email}


class TestTournamentE2E:
    """
    Full flow: create tournament (fee=0, 4 slots), register 4 fresh users,
    start (bracket built), report 2 semis (both agree → winner advances),
    report final (both agree → tournament completes, prize pool payout).
    """

    def test_full_bracket_flow(self, demo_token):
        # 3 additional users (demo will be the 4th)
        u1 = _make_verified_user()
        u2 = _make_verified_user()
        u3 = _make_verified_user()

        # Create tournament with prize_pool=0 (entry_fee=0 means no auto pool)
        # Use small prize_pool to test payout branch too
        payload = {"name": f"TEST E2E {uuid.uuid4().hex[:6]}", "game": "FIFA 25",
                   "platform": "PC", "entry_fee": 0.0, "max_players": 4, "prize_pool": 100.0}
        cr = _post("/tournaments", payload, token=demo_token)
        assert cr.status_code == 200, cr.text
        tid = cr.json()["id"]

        # Register all 4
        for tok in (demo_token, u1["token"], u2["token"], u3["token"]):
            r = _post(f"/tournaments/{tid}/register", token=tok)
            assert r.status_code == 200, f"register failed: {r.text}"

        # Start
        s = _post(f"/tournaments/{tid}/start", token=demo_token)
        assert s.status_code == 200, s.text
        brackets = s.json()["brackets"]
        # Expect 2 rounds for 4 players: round 0 = 2 matches, round 1 = 1 match
        assert len(brackets) == 2, f"expected 2 rounds, got {len(brackets)}"
        assert len(brackets[0]) == 2 and len(brackets[1]) == 1

        # Build map user_id → token
        me = _get("/auth/me", token=demo_token).json()
        token_by_uid = {
            me["id"]: demo_token,
            u1["user"]["id"]: u1["token"],
            u2["user"]["id"]: u2["token"],
            u3["user"]["id"]: u3["token"],
        }

        # Report both semis; both participants agree on p1 winning
        winners_round1 = []
        for m in brackets[0]:
            assert m["status"] == "ready", f"match status={m['status']}"
            p1_uid = m["p1"]["user_id"]
            p2_uid = m["p2"]["user_id"]
            # Both report p1 as winner
            r1 = _post(f"/tournaments/{tid}/report",
                       {"match_id": m["id"], "winner_id": p1_uid, "my_score": 3, "opponent_score": 1, "evidence": None},
                       token=token_by_uid[p1_uid])
            assert r1.status_code == 200, r1.text
            r2 = _post(f"/tournaments/{tid}/report",
                       {"match_id": m["id"], "winner_id": p1_uid, "my_score": 1, "opponent_score": 3, "evidence": None},
                       token=token_by_uid[p2_uid])
            assert r2.status_code == 200, r2.text
            assert r2.json().get("finalized") is True, f"expected finalized, got {r2.json()}"
            winners_round1.append(p1_uid)

        # Fetch tournament, verify round 1 (final) has both players and is ready
        t = _get(f"/tournaments/{tid}").json()
        finals = t["brackets"][1][0]
        assert finals.get("p1") and finals.get("p2"), f"final match not populated: {finals}"
        assert finals["status"] == "ready"
        finals_p1 = finals["p1"]["user_id"]
        finals_p2 = finals["p2"]["user_id"]
        assert set([finals_p1, finals_p2]) == set(winners_round1)

        # Both report finals_p1 as champion
        r1 = _post(f"/tournaments/{tid}/report",
                   {"match_id": finals["id"], "winner_id": finals_p1, "my_score": 2, "opponent_score": 0},
                   token=token_by_uid[finals_p1])
        assert r1.status_code == 200, r1.text
        r2 = _post(f"/tournaments/{tid}/report",
                   {"match_id": finals["id"], "winner_id": finals_p1, "my_score": 0, "opponent_score": 2},
                   token=token_by_uid[finals_p2])
        assert r2.status_code == 200, r2.text
        assert r2.json().get("finalized") is True

        # Tournament should now be completed
        t2 = _get(f"/tournaments/{tid}").json()
        assert t2["status"] == "completed", f"expected completed, got {t2['status']}"
        assert t2.get("winner_id") == finals_p1

        # Winner wallet should have received 70% of 100 = 70
        winner_tok = token_by_uid[finals_p1]
        txs = _get("/wallet/transactions", token=winner_tok).json()
        prize_txs = [t for t in txs if t.get("type") == "prize_winning" and t.get("ref_id") == tid]
        assert prize_txs, "no prize_winning tx for winner"
        assert abs(prize_txs[0]["amount"] - 70.0) < 0.01, f"expected 70, got {prize_txs[0]['amount']}"

        # Runner-up should have received 20% = 20
        runner_tok = token_by_uid[finals_p2]
        txs_r = _get("/wallet/transactions", token=runner_tok).json()
        prize_txs_r = [t for t in txs_r if t.get("type") == "prize_winning" and t.get("ref_id") == tid]
        assert prize_txs_r, "no prize_winning tx for runner-up"
        assert abs(prize_txs_r[0]["amount"] - 20.0) < 0.01

    def test_tournament_report_dispute_and_admin_resolve(self, demo_token, admin_token):
        """Report same match with disagreement → disputed → admin resolves."""
        u1 = _make_verified_user()
        payload = {"name": f"TEST Dispute {uuid.uuid4().hex[:6]}", "game": "FIFA 25",
                   "platform": "PC", "entry_fee": 0.0, "max_players": 2, "prize_pool": 0}
        cr = _post("/tournaments", payload, token=demo_token)
        assert cr.status_code == 200
        tid = cr.json()["id"]
        _post(f"/tournaments/{tid}/register", token=demo_token)
        _post(f"/tournaments/{tid}/register", token=u1["token"])
        s = _post(f"/tournaments/{tid}/start", token=demo_token)
        assert s.status_code == 200
        brackets = s.json()["brackets"]
        m = brackets[0][0]
        p1_uid = m["p1"]["user_id"]
        p2_uid = m["p2"]["user_id"]
        tok_map = {p1_uid: (demo_token if p1_uid == _get("/auth/me", token=demo_token).json()["id"] else u1["token"]),
                   p2_uid: (demo_token if p2_uid == _get("/auth/me", token=demo_token).json()["id"] else u1["token"])}
        # Disagree
        r1 = _post(f"/tournaments/{tid}/report",
                   {"match_id": m["id"], "winner_id": p1_uid}, token=tok_map[p1_uid])
        assert r1.status_code == 200
        r2 = _post(f"/tournaments/{tid}/report",
                   {"match_id": m["id"], "winner_id": p2_uid}, token=tok_map[p2_uid])
        assert r2.status_code == 200
        assert r2.json().get("disputed") is True

        # Admin sees dispute
        disp = _get("/admin/disputes", token=admin_token).json()
        assert any(x["tournament"]["id"] == tid for x in disp["tournament_matches"]), \
            "disputed tournament match not in admin disputes"

        # Admin resolves in favor of p1
        rv = _post(f"/admin/tournaments/{tid}/matches/{m['id']}/resolve",
                   {"winner_id": p1_uid}, token=admin_token)
        assert rv.status_code == 200
        t = _get(f"/tournaments/{tid}").json()
        assert t["status"] == "completed"
        assert t["winner_id"] == p1_uid


# ============================================================
# CHALLENGE REPORT WITH SCORE / EVIDENCE (Iteration 2)
# ============================================================
class TestChallengeReportScores:
    def test_report_stores_score_and_evidence(self, demo_token, second_user):
        cr = _post("/challenges", {"game": "Call of Duty", "platform": "PC", "stake": 0.0, "region": "GLOBAL", "notes": "TEST scores"},
                   token=demo_token)
        assert cr.status_code == 200
        ch_id = cr.json()["id"]
        acc = _post(f"/challenges/{ch_id}/accept", token=second_user["token"])
        assert acc.status_code == 200
        demo_uid = _get("/auth/me", token=demo_token).json()["id"]
        # small fake base64 evidence
        ev = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=="
        r1 = _post(f"/challenges/{ch_id}/report",
                   {"winner_id": demo_uid, "my_score": 5, "opponent_score": 2, "evidence": ev},
                   token=demo_token)
        assert r1.status_code == 200
        # Verify results persisted with score+evidence
        det = _get(f"/challenges/{ch_id}", token=demo_token).json()
        res = (det.get("results") or {}).get(demo_uid, {})
        assert res.get("my_score") == 5
        assert res.get("opponent_score") == 2
        assert res.get("evidence") == ev
        # 2nd user reports agreeing → finalized
        r2 = _post(f"/challenges/{ch_id}/report",
                   {"winner_id": demo_uid, "my_score": 2, "opponent_score": 5},
                   token=second_user["token"])
        assert r2.status_code == 200
        det2 = _get(f"/challenges/{ch_id}", token=demo_token).json()
        assert det2["status"] in ("finalized", "completed", "settled")


# ============================================================
# LEADERBOARDS / NOTIFICATIONS / SUPPORT
# ============================================================
class TestOther:
    def test_leaderboard_global(self):
        r = _get("/leaderboards/global")
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            assert "user_id" in arr[0] and "rank" in arr[0]

    def test_notifications(self, demo_token):
        r = _get("/notifications", token=demo_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        rr = _post("/notifications/read-all", token=demo_token)
        assert rr.status_code == 200

    def test_support_ticket_flow(self, demo_token):
        cr = _post("/support/tickets", {"subject": "TEST issue", "message": "hello", "category": "general"},
                   token=demo_token)
        assert cr.status_code == 200, cr.text
        lst = _get("/support/tickets", token=demo_token)
        assert lst.status_code == 200
        assert isinstance(lst.json(), list)


# ============================================================
# ADMIN
# ============================================================
class TestAdmin:
    def test_admin_users(self, admin_token):
        r = _get("/admin/users", token=admin_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_analytics(self, admin_token):
        r = _get("/admin/analytics", token=admin_token)
        assert r.status_code == 200
        d = r.json()
        assert "users" in d or "total_users" in d or isinstance(d, dict)

    def test_admin_revenue(self, admin_token):
        r = _get("/admin/revenue", token=admin_token)
        assert r.status_code == 200

    def test_admin_disputes(self, admin_token):
        # Iteration 2: response is now {challenges: [...], tournament_matches: [...]}
        r = _get("/admin/disputes", token=admin_token)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, dict)
        assert "challenges" in d and isinstance(d["challenges"], list)
        assert "tournament_matches" in d and isinstance(d["tournament_matches"], list)

    def test_admin_forbidden_for_regular(self, demo_token):
        r = _get("/admin/users", token=demo_token)
        assert r.status_code == 403

    def test_admin_suspend_and_unsuspend(self, admin_token, second_user):
        uid_ = second_user["user"]["id"]
        s = _post(f"/admin/users/{uid_}/suspend", token=admin_token)
        assert s.status_code == 200
        u = _post(f"/admin/users/{uid_}/unsuspend", token=admin_token)
        assert u.status_code == 200

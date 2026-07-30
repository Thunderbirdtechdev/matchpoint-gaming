"""
Iteration 3: Tiered platform fee + Tiered same-day withdrawal fee coverage.
- GET /api/meta/fees returns platform_tiers / withdrawal_tiers_same_day / withdrawal_speeds
- GET /api/meta/fee-preview?pool=... returns rate+service_fee+net_prize per tier
- H2H finalize applies tiered platform fee (stake*2 = pool)
- Withdrawal standard=Free, same-day tiered flat + 1% on $1,001+, revenue only for same-day
- Tournament 4-player $25 entry → pool $100 → 8% fee tier, 70/30 net split
"""
import os
import uuid
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://matchpoint-play.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "matchpoint_db")


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


def _login_2fa(email, password):
    r = _post("/auth/login", {"email": email, "password": password})
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    r2 = _post("/auth/verify-2fa", {"email": email, "code": code})
    assert r2.status_code == 200, r2.text
    d = r2.json()
    return d["access_token"], d["user"]


def _make_verified_user():
    email = f"TEST_fee_{uuid.uuid4().hex[:8]}@matchpoint.gg"
    pwd = "Test@1234"
    uname = f"TEST_{uuid.uuid4().hex[:6]}"
    r = _post("/auth/register", {"email": email, "password": pwd, "username": uname})
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    v = _post("/auth/verify-email", {"email": email, "code": code})
    assert v.status_code == 200, v.text
    tok, u = _login_2fa(email, pwd)
    return {"email": email, "password": pwd, "token": tok, "user": u}


def _seed_balance(user_id: str, amount: float):
    """Direct-DB balance top-up (bypass Stripe/admin routes)."""
    async def _do():
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            db = client[DB_NAME]
            await db.users.update_one({"id": user_id}, {"$set": {"wallet_balance": amount}})
        finally:
            client.close()
    asyncio.get_event_loop().run_until_complete(_do())


# =============== META ENDPOINTS ===============
class TestMetaFees:
    def test_meta_fees_shape(self):
        r = _get("/meta/fees")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "platform_tiers" in d and "withdrawal_tiers_same_day" in d and "withdrawal_speeds" in d
        # Platform tiers: 4 entries with the correct rates
        rates = [t["rate"] for t in d["platform_tiers"]]
        assert rates == [0.10, 0.08, 0.06, 0.05], f"unexpected rates: {rates}"
        labels = [t["label"] for t in d["platform_tiers"]]
        assert labels[0].startswith("$1") and labels[-1] == "$501+"
        # Withdrawal same-day tiers
        wd = d["withdrawal_tiers_same_day"]
        assert len(wd) == 6
        assert wd[0]["flat_fee_cents"] == 199 and wd[0]["label"] == "$10 – $50"
        assert wd[-1]["pct_rate"] == 0.01 and wd[-1]["label"] == "$1,001+"
        # Withdrawal speed list
        speeds = {s["key"] for s in d["withdrawal_speeds"]}
        assert speeds == {"standard", "same_day"}

    def test_fee_preview_pool_20(self):
        r = _get("/meta/fee-preview", params={"pool": 20})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["rate"] == 0.10
        assert abs(d["service_fee"] - 2.0) < 0.001
        assert abs(d["net_prize"] - 18.0) < 0.001

    def test_fee_preview_pool_200(self):
        d = _get("/meta/fee-preview", params={"pool": 200}).json()
        assert d["rate"] == 0.06
        assert abs(d["service_fee"] - 12.0) < 0.001

    def test_fee_preview_pool_750(self):
        d = _get("/meta/fee-preview", params={"pool": 750}).json()
        assert d["rate"] == 0.05
        assert abs(d["service_fee"] - 37.5) < 0.01

    def test_fee_preview_boundaries(self):
        # 25 → still 10% ; 25.01 → 8% ; 100 → 8% ; 500 → 6% ; 500.01 → 5%
        assert _get("/meta/fee-preview", params={"pool": 25}).json()["rate"] == 0.10
        assert _get("/meta/fee-preview", params={"pool": 25.01}).json()["rate"] == 0.08
        assert _get("/meta/fee-preview", params={"pool": 100}).json()["rate"] == 0.08
        assert _get("/meta/fee-preview", params={"pool": 500}).json()["rate"] == 0.06
        assert _get("/meta/fee-preview", params={"pool": 500.01}).json()["rate"] == 0.05


# =============== H2H TIERED FEE ===============
class TestH2HTieredFee:
    def test_h2h_stake_20_pool_40_tier_math(self):
        """stake $20 → pool $40 → per FEE_TIERS, pool $26–$100 → 8% → fee $3.20, payout $36.80.
        NOTE: Review request text mentioned tier '$1-$25' fee=$4 for this case, but pool is
        stake*2=$40 which lies in $26–$100 → 8%. Backend behavior matches fees.py; the review
        text's tier label was inconsistent with its own tier definition.
        """
        u_a = _make_verified_user()
        u_b = _make_verified_user()
        _seed_balance(u_a["user"]["id"], 500.0)
        _seed_balance(u_b["user"]["id"], 500.0)
        cr = _post("/challenges",
                   {"game": "FIFA 25", "platform": "PC", "stake": 20.0, "region": "GLOBAL", "notes": "TEST fee-tier-20"},
                   token=u_a["token"])
        assert cr.status_code == 200, cr.text
        ch_id = cr.json()["id"]
        acc = _post(f"/challenges/{ch_id}/accept", token=u_b["token"])
        assert acc.status_code == 200, acc.text
        winner_id = u_a["user"]["id"]
        _post(f"/challenges/{ch_id}/report", {"winner_id": winner_id}, token=u_a["token"])
        r2 = _post(f"/challenges/{ch_id}/report", {"winner_id": winner_id}, token=u_b["token"])
        assert r2.status_code == 200, r2.text
        det = _get(f"/challenges/{ch_id}", token=u_a["token"]).json()
        assert det["status"] == "finalized"
        # Per fees.py: pool=40 is $26-$100 tier @ 8% → fee=3.20, payout=36.80
        assert det.get("fee_rate") == 0.08, f"expected 8% (pool $40 in $26-$100), got {det.get('fee_rate')}"
        assert det.get("fee_tier") == "$26 – $100", f"got {det.get('fee_tier')}"
        assert abs(det["platform_fee"] - 3.20) < 0.01
        assert abs(det["payout"] - 36.80) < 0.01

    def test_h2h_stake_100_charges_6pct(self):
        """stake $100 → pool $200 → 6% tier ($101–$500) → fee $12, payout $188."""
        u_a = _make_verified_user()
        u_b = _make_verified_user()
        _seed_balance(u_a["user"]["id"], 500.0)
        _seed_balance(u_b["user"]["id"], 500.0)
        cr = _post("/challenges",
                   {"game": "FIFA 25", "platform": "PC", "stake": 100.0, "region": "GLOBAL", "notes": "TEST fee-tier-100"},
                   token=u_a["token"])
        assert cr.status_code == 200, cr.text
        ch_id = cr.json()["id"]
        _post(f"/challenges/{ch_id}/accept", token=u_b["token"])
        winner_id = u_a["user"]["id"]
        _post(f"/challenges/{ch_id}/report", {"winner_id": winner_id}, token=u_a["token"])
        _post(f"/challenges/{ch_id}/report", {"winner_id": winner_id}, token=u_b["token"])
        det = _get(f"/challenges/{ch_id}", token=u_a["token"]).json()
        assert det["status"] == "finalized"
        assert det.get("fee_rate") == 0.06, f"got rate {det.get('fee_rate')}"
        assert det.get("fee_tier") == "$101 – $500"
        assert abs(det["platform_fee"] - 12.0) < 0.01
        assert abs(det["payout"] - 188.0) < 0.01


# =============== WITHDRAWAL TIERED ===============
class TestWithdrawalTiered:
    @pytest.fixture
    def funded_user(self):
        u = _make_verified_user()
        _seed_balance(u["user"]["id"], 5000.0)
        return u

    def test_withdraw_standard_free(self, funded_user):
        r = _post("/wallet/withdraw", {"amount": 50.0, "bank_account": "****1", "speed": "standard"},
                  token=funded_user["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["fee"] == 0
        assert abs(d["net"] - 50.0) < 0.01
        assert d["speed"] == "standard"
        assert d["tier"] == "Free"
        assert "2" in d["eta"] and "business" in d["eta"].lower()

    def test_withdraw_same_day_25(self, funded_user):
        r = _post("/wallet/withdraw", {"amount": 25.0, "bank_account": "****2", "speed": "same_day"},
                  token=funded_user["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["fee"] - 1.99) < 0.001
        assert abs(d["net"] - 23.01) < 0.001
        assert d["tier"] == "$10 – $50"

    def test_withdraw_same_day_500(self, funded_user):
        r = _post("/wallet/withdraw", {"amount": 500.0, "bank_account": "****3", "speed": "same_day"},
                  token=funded_user["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["fee"] - 7.99) < 0.01, f"got fee {d['fee']}"
        assert d["tier"] == "$251 – $500"

    def test_withdraw_same_day_2000_pct(self):
        u = _make_verified_user()
        _seed_balance(u["user"]["id"], 3000.0)
        r = _post("/wallet/withdraw", {"amount": 2000.0, "bank_account": "****4", "speed": "same_day"},
                  token=u["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert abs(d["fee"] - 20.0) < 0.01, f"got fee {d['fee']}"
        assert d["tier"] == "$1,001+"

    def test_standard_generates_no_revenue_row(self, admin_token):
        """Compare revenue rows around a standard withdrawal → should not add withdrawal_fee row."""
        u = _make_verified_user()
        _seed_balance(u["user"]["id"], 300.0)
        rows_before = _get("/admin/revenue", token=admin_token).json()
        wf_before = sum(1 for r in rows_before if r.get("type") == "withdrawal_fee")
        r = _post("/wallet/withdraw", {"amount": 60.0, "bank_account": "****9", "speed": "standard"},
                  token=u["token"])
        assert r.status_code == 200, r.text
        rows_after = _get("/admin/revenue", token=admin_token).json()
        wf_after = sum(1 for r in rows_after if r.get("type") == "withdrawal_fee")
        assert wf_after == wf_before, f"standard withdrawal added withdrawal_fee row (before={wf_before} after={wf_after})"

    def test_same_day_generates_revenue(self, admin_token):
        u = _make_verified_user()
        _seed_balance(u["user"]["id"], 300.0)
        before = _get("/admin/revenue", token=admin_token).json()
        wf_before = sum(1 for r in before if r.get("type") == "withdrawal_fee")
        r = _post("/wallet/withdraw", {"amount": 60.0, "bank_account": "****10", "speed": "same_day"},
                  token=u["token"])
        assert r.status_code == 200, r.text
        after = _get("/admin/revenue", token=admin_token).json()
        wf_after = sum(1 for r in after if r.get("type") == "withdrawal_fee")
        assert wf_after == wf_before + 1, f"expected +1 withdrawal_fee row, before={wf_before} after={wf_after}"
        # Fee for $60 same-day is $2.99 (tier $51-$100)
        latest = next((r for r in after if r.get("type") == "withdrawal_fee"), None)
        assert latest is not None
        assert abs(latest["amount"] - 2.99) < 0.01, f"expected fee 2.99, got {latest['amount']}"


@pytest.fixture(scope="session")
def admin_token():
    tok, _ = _login_2fa("admin@matchpoint.gg", "Admin@123")
    return tok


# =============== TOURNAMENT 4-PLAYER TIERED ===============
class TestTournamentTieredFee:
    def test_4_players_25_entry_pool_100(self, admin_token):
        """4 players × $25 = $100 pool → 8% tier '$26–$100' → net $92 → winner $64.40, RU $27.60."""
        users = [_make_verified_user() for _ in range(4)]
        for u in users:
            _seed_balance(u["user"]["id"], 500.0)
        # Create with entry_fee=25 and 4 slots — prize_pool derives from entries later.
        payload = {"name": f"TEST TieredFee {uuid.uuid4().hex[:6]}", "game": "FIFA 25",
                   "platform": "PC", "entry_fee": 25.0, "max_players": 4, "prize_pool": 0}
        cr = _post("/tournaments", payload, token=users[0]["token"])
        assert cr.status_code == 200, cr.text
        tid = cr.json()["id"]
        # Register all 4
        for u in users:
            r = _post(f"/tournaments/{tid}/register", token=u["token"])
            assert r.status_code == 200, f"register: {r.text}"
        # Start
        s = _post(f"/tournaments/{tid}/start", token=users[0]["token"])
        assert s.status_code == 200, s.text
        brackets = s.json()["brackets"]
        t_state = _get(f"/tournaments/{tid}").json()
        pool = t_state.get("prize_pool", 0)
        assert abs(pool - 100.0) < 0.01, f"expected pool $100, got {pool}"

        token_by_uid = {u["user"]["id"]: u["token"] for u in users}
        # Play semis; report p1 as winner in each
        winners = []
        for m in brackets[0]:
            p1 = m["p1"]["user_id"]; p2 = m["p2"]["user_id"]
            _post(f"/tournaments/{tid}/report",
                  {"match_id": m["id"], "winner_id": p1, "my_score": 3, "opponent_score": 1},
                  token=token_by_uid[p1])
            _post(f"/tournaments/{tid}/report",
                  {"match_id": m["id"], "winner_id": p1, "my_score": 1, "opponent_score": 3},
                  token=token_by_uid[p2])
            winners.append(p1)
        # Final
        t = _get(f"/tournaments/{tid}").json()
        finals = t["brackets"][1][0]
        fp1 = finals["p1"]["user_id"]; fp2 = finals["p2"]["user_id"]
        _post(f"/tournaments/{tid}/report",
              {"match_id": finals["id"], "winner_id": fp1, "my_score": 2, "opponent_score": 0},
              token=token_by_uid[fp1])
        _post(f"/tournaments/{tid}/report",
              {"match_id": finals["id"], "winner_id": fp1, "my_score": 0, "opponent_score": 2},
              token=token_by_uid[fp2])
        t2 = _get(f"/tournaments/{tid}").json()
        assert t2["status"] == "completed"
        assert t2["winner_id"] == fp1
        # Verify tiered fee metadata
        assert t2.get("fee_tier") == "$26 – $100", f"got {t2.get('fee_tier')}"
        assert abs(t2.get("final_platform_fee", 0) - 8.0) < 0.01, f"fee={t2.get('final_platform_fee')}"
        assert abs(t2.get("final_payout", 0) - 64.40) < 0.01, f"payout={t2.get('final_payout')}"
        assert abs(t2.get("final_runner_up_prize", 0) - 27.60) < 0.01, f"ru={t2.get('final_runner_up_prize')}"

        # Winner should have received 64.40 in wallet_tx
        winner_tok = token_by_uid[fp1]
        txs = _get("/wallet/transactions", token=winner_tok).json()
        prize = [t for t in txs if t.get("type") == "prize_winning" and t.get("ref_id") == tid]
        assert prize and abs(prize[0]["amount"] - 64.40) < 0.01, f"prize tx = {prize}"

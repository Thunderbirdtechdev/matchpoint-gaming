"""MatchPoint Backend - FastAPI + MongoDB
Skill-based competitive gaming platform with wallet, H2H, tournaments.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Literal
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os, uuid, secrets, hashlib, logging, httpx, jwt, bcrypt, asyncio, random
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest, CheckoutStatusResponse
from fees import (
    calculate_fee, calculate_challenge_fee, calculate_tournament_fee,
    calculate_withdrawal_fee, FEE_TIERS, SAME_DAY_WITHDRAWAL_TIERS,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ACCESS_MIN = int(os.environ.get("JWT_ACCESS_MINUTES", "60"))
JWT_REFRESH_DAYS = int(os.environ.get("JWT_REFRESH_DAYS", "30"))
STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "MatchPoint")
APP_URL = os.environ.get("APP_URL", "http://localhost")
PLATFORM_FEE_PCT = float(os.environ.get("PLATFORM_FEE_PERCENT", "10"))
WITHDRAWAL_FEE_PCT = float(os.environ.get("WITHDRAWAL_FEE_PERCENT", "2"))
EMAIL_BASE_URL = "https://integrations.emergentagent.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="MatchPoint API")
api = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ------------------------- Helpers -------------------------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def _otp_expired(otp: dict) -> bool:
    """Compare OTP expires_at with utcnow, normalizing tz-naive datetimes returned from Mongo."""
    exp = otp.get("expires_at")
    if exp is None:
        return True
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    return exp < utcnow()

def uid() -> str:
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False

def make_jwt(user_id: str, minutes: int = JWT_ACCESS_MIN) -> str:
    now = utcnow()
    return jwt.encode(
        {"sub": user_id, "iat": int(now.timestamp()), "exp": int((now + timedelta(minutes=minutes)).timestamp())},
        JWT_SECRET, algorithm="HS256"
    )

def sha(t: str) -> str:
    return hashlib.sha256(t.encode()).hexdigest()

def make_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def serialize(doc: dict) -> dict:
    """Strip Mongo _id from a doc."""
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc

async def send_email(to: str, subject: str, html: str):
    """Non-blocking email via Emergent-managed Resend."""
    if not EMAIL_KEY:
        logger.warning(f"[EMAIL MOCKED] To={to} Subject={subject}")
        return
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME},
            )
            if r.status_code >= 400:
                logger.error(f"Email send failed: {r.status_code} {r.text}")
    except Exception as e:
        logger.error(f"Email error: {e}")

def otp_email(code: str, purpose: str) -> str:
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#111210;padding:32px;font-family:Arial,sans-serif;">
      <tr><td align="center">
        <div style="background:#191B18;border:1px solid #2C3129;border-radius:12px;padding:32px;max-width:480px;">
          <h1 style="color:#CCFF00;margin:0 0 16px;font-size:28px;">MatchPoint</h1>
          <p style="color:#F4F5F0;font-size:16px;">Your {purpose} code:</p>
          <p style="color:#CCFF00;font-size:40px;font-weight:bold;letter-spacing:8px;margin:24px 0;">{code}</p>
          <p style="color:#9CA394;font-size:14px;">This code expires in 10 minutes.</p>
        </div>
      </td></tr>
    </table>
    """

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if not credentials or not credentials.credentials:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(401, "User not found")
    if user.get("suspended"):
        raise HTTPException(403, "Account suspended")
    # Touch most-recent session for DAU/MAU (fire and forget)
    now_iso = utcnow().isoformat()
    async def _touch():
        await db.sessions.update_many(
            {"user_id": user_id, "revoked": False},
            {"$set": {"last_seen": now_iso}},
        )
    asyncio.create_task(_touch())
    return serialize(user)

async def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin only")
    return user


async def require_player(user: dict = Depends(current_user)) -> dict:
    """Reject admin accounts from player-facing actions (wagers, wallet, matches)."""
    if user.get("is_admin"):
        raise HTTPException(403, "Admin accounts cannot participate as players")
    return user

# ------------------------- Models -------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    username: str

class VerifyOtpIn(BaseModel):
    email: EmailStr
    code: str

class LoginIn(BaseModel):
    email: EmailStr
    password: str
    device_name: Optional[str] = "Mobile"

class ResetIn(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None  # base64
    favorite_games: Optional[List[str]] = None

class DepositIn(BaseModel):
    amount: float  # in dollars

class WithdrawIn(BaseModel):
    amount: float
    speed: Literal["standard", "same_day"] = "standard"
    bank_account: Optional[str] = "****1234"

class ChallengeIn(BaseModel):
    game: str
    platform: str  # PC / PS5 / Xbox / Mobile
    stake: float
    region: str = "GLOBAL"
    notes: Optional[str] = ""
    opponent_username: Optional[str] = None  # If set, creates a private invite to that user only

class ChallengeResultIn(BaseModel):
    winner_id: str  # "me" or opponent id
    my_score: Optional[int] = None
    opponent_score: Optional[int] = None
    evidence: Optional[str] = None  # base64 screenshot

class TournamentMatchReportIn(BaseModel):
    match_id: str
    winner_id: str  # user_id of the player who won
    my_score: Optional[int] = None
    opponent_score: Optional[int] = None
    evidence: Optional[str] = None

class TournamentIn(BaseModel):
    name: str
    game: str
    platform: str
    entry_fee: float
    max_players: int = 16
    prize_pool: float = 0
    tournament_type: Literal["public", "private", "invite", "sponsored"] = "public"
    start_at: Optional[str] = None
    banner: Optional[str] = None
    sponsor: Optional[str] = None
    description: Optional[str] = ""

class TicketIn(BaseModel):
    subject: str
    message: str
    category: str = "general"

class ReportIn(BaseModel):
    target_type: Literal["player", "bug", "challenge"]
    target_id: Optional[str] = None
    reason: str
    evidence: Optional[str] = None

class AdIn(BaseModel):
    title: str
    image: str
    link: Optional[str] = ""
    placement: Literal["home", "discover", "tournaments"] = "home"
    active: bool = True

# ------------------------- Seed / init -------------------------
GAMES = ["FIFA 25", "Call of Duty", "Fortnite", "Rocket League", "Street Fighter 6", "Valorant", "Apex Legends", "Mortal Kombat 1"]
PLATFORMS = ["PC", "PS5", "Xbox", "Mobile"]
REGIONS = ["NA", "EU", "APAC", "LATAM", "GLOBAL"]

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("username", unique=True)
    await db.otp.create_index([("email", 1), ("purpose", 1)])
    await db.otp.create_index("expires_at", expireAfterSeconds=0)
    await db.sessions.create_index("id", unique=True)
    await db.challenges.create_index("id", unique=True)
    await db.tournaments.create_index("id", unique=True)
    await db.wallet_tx.create_index("id", unique=True)
    await db.stripe_events.create_index("id", unique=True)
    # Seed a single admin account for admin dashboard access (no other seed data).
    admin = await db.users.find_one({"email": "admin@matchpoint.gg"})
    if not admin:
        await db.users.insert_one({
            "id": uid(), "email": "admin@matchpoint.gg", "username": "admin",
            "password_hash": hash_pw("Admin@123"),
            "email_verified": True, "is_admin": True, "suspended": False,
            "bio": "MatchPoint Administrator", "avatar": "", "favorite_games": [],
            "wallet_balance": 0.0, "pending_balance": 0.0,
            "stats": {"wins": 0, "losses": 0, "earnings": 0.0, "rank": 1500, "matches": 0},
            "badges": ["founder"], "created_at": utcnow().isoformat(),
        })

# ============================================================
# AUTH
# ============================================================
@api.post("/auth/register")
async def register(data: RegisterIn):
    if len(data.password) < 6:
        raise HTTPException(400, "Password too short (min 6)")
    existing = await db.users.find_one({"email": data.email})
    if existing:
        # Enumeration-safe generic message but still 400 for client UX
        raise HTTPException(400, "Email already registered")
    user_id = uid()
    await db.users.insert_one({
        "id": user_id, "email": data.email, "username": data.username,
        "password_hash": hash_pw(data.password),
        "email_verified": False, "is_admin": False, "suspended": False,
        "bio": "", "avatar": "", "favorite_games": [],
        "wallet_balance": 0.0, "pending_balance": 0.0,
        "stats": {"wins": 0, "losses": 0, "earnings": 0.0, "rank": 1500, "matches": 0},
        "badges": [], "created_at": utcnow().isoformat(),
    })
    code = make_otp()
    await db.otp.insert_one({
        "email": data.email, "purpose": "verify_email",
        "code_hash": sha(code), "attempts": 0,
        "expires_at": utcnow() + timedelta(minutes=10),
    })
    asyncio.create_task(send_email(data.email, "Verify your MatchPoint email", otp_email(code, "email verification")))
    return {"ok": True, "message": "Verification code sent", "dev_code": code}  # dev_code for testing

@api.post("/auth/verify-email")
async def verify_email(data: VerifyOtpIn):
    otp = await db.otp.find_one({"email": data.email, "purpose": "verify_email", "used": {"$ne": True}}, sort=[("expires_at", -1)])
    if not otp or otp["code_hash"] != sha(data.code) or _otp_expired(otp):
        raise HTTPException(400, "Invalid or expired code")
    await db.otp.update_one({"_id": otp["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"email": data.email}, {"$set": {"email_verified": True}})
    return {"ok": True}

@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if user.get("suspended"):
        raise HTTPException(403, "Account suspended")
    if not user.get("email_verified"):
        # Auto-resend verification code
        code = make_otp()
        await db.otp.insert_one({
            "email": data.email, "purpose": "verify_email",
            "code_hash": sha(code), "attempts": 0,
            "expires_at": utcnow() + timedelta(minutes=10),
        })
        asyncio.create_task(send_email(data.email, "Verify your MatchPoint email", otp_email(code, "email verification")))
        return {"require_verification": True, "dev_code": code}
    # Issue 2FA challenge
    code = make_otp()
    await db.otp.insert_one({
        "email": data.email, "purpose": "login_2fa",
        "code_hash": sha(code), "attempts": 0,
        "expires_at": utcnow() + timedelta(minutes=10),
    })
    asyncio.create_task(send_email(data.email, "Your MatchPoint login code", otp_email(code, "2FA login")))
    return {"require_2fa": True, "email": data.email, "dev_code": code}

@api.post("/auth/verify-2fa")
async def verify_2fa(data: VerifyOtpIn, x_device_name: Optional[str] = Header(default="Mobile")):
    otp = await db.otp.find_one({"email": data.email, "purpose": "login_2fa", "used": {"$ne": True}}, sort=[("expires_at", -1)])
    if not otp or otp["code_hash"] != sha(data.code) or _otp_expired(otp):
        raise HTTPException(400, "Invalid or expired code")
    await db.otp.update_one({"_id": otp["_id"]}, {"$set": {"used": True}})
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(404, "User not found")
    token = make_jwt(user["id"])
    session_id = uid()
    await db.sessions.insert_one({
        "id": session_id, "user_id": user["id"], "device_name": x_device_name or "Mobile",
        "created_at": utcnow().isoformat(), "last_seen": utcnow().isoformat(),
        "revoked": False,
    })
    return {"access_token": token, "user": serialize({**user, "password_hash": None}), "session_id": session_id}

@api.post("/auth/forgot-password")
async def forgot_password(data: dict):
    email = data.get("email")
    if not email:
        raise HTTPException(400, "Email required")
    user = await db.users.find_one({"email": email})
    if user:
        code = make_otp()
        await db.otp.insert_one({
            "email": email, "purpose": "reset_password",
            "code_hash": sha(code), "attempts": 0,
            "expires_at": utcnow() + timedelta(minutes=10),
        })
        asyncio.create_task(send_email(email, "Reset your MatchPoint password", otp_email(code, "password reset")))
        return {"ok": True, "dev_code": code}
    return {"ok": True}

@api.post("/auth/reset-password")
async def reset_password(data: ResetIn):
    otp = await db.otp.find_one({"email": data.email, "purpose": "reset_password", "used": {"$ne": True}}, sort=[("expires_at", -1)])
    if not otp or otp["code_hash"] != sha(data.code) or _otp_expired(otp):
        raise HTTPException(400, "Invalid or expired code")
    if len(data.new_password) < 6:
        raise HTTPException(400, "Password too short")
    await db.otp.update_one({"_id": otp["_id"]}, {"$set": {"used": True}})
    await db.users.update_one({"email": data.email}, {"$set": {"password_hash": hash_pw(data.new_password)}})
    # Revoke all sessions
    user = await db.users.find_one({"email": data.email})
    if user:
        await db.sessions.update_many({"user_id": user["id"]}, {"$set": {"revoked": True}})
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    user["password_hash"] = None
    return user

@api.get("/auth/sessions")
async def list_sessions(user: dict = Depends(current_user)):
    cursor = db.sessions.find({"user_id": user["id"], "revoked": False}, {"_id": 0})
    return await cursor.to_list(100)

@api.post("/auth/sessions/{session_id}/revoke")
async def revoke_session(session_id: str, user: dict = Depends(current_user)):
    await db.sessions.update_one({"id": session_id, "user_id": user["id"]}, {"$set": {"revoked": True}})
    return {"ok": True}

@api.post("/auth/logout")
async def logout(user: dict = Depends(current_user)):
    return {"ok": True}

# ============================================================
# PROFILE
# ============================================================
@api.get("/profile/{user_id}")
async def get_profile(user_id: str, _: dict = Depends(current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(404, "User not found")
    return user

@api.patch("/profile")
async def update_profile(data: ProfileUpdate, user: dict = Depends(current_user)):
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

@api.get("/profile/{user_id}/matches")
async def user_matches(user_id: str, _: dict = Depends(current_user)):
    cursor = db.challenges.find({
        "$or": [{"creator_id": user_id}, {"opponent_id": user_id}],
        "status": {"$in": ["finalized", "cancelled"]},
    }, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(50)

# ============================================================
# WALLET
# ============================================================
@api.get("/wallet")
async def wallet(user: dict = Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return {
        "balance": u.get("wallet_balance", 0),
        "pending": u.get("pending_balance", 0),
        "available": u.get("wallet_balance", 0) - u.get("pending_balance", 0),
        "earnings": u.get("stats", {}).get("earnings", 0),
    }

@api.get("/wallet/transactions")
async def wallet_txs(user: dict = Depends(current_user)):
    cursor = db.wallet_tx.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)

@api.post("/wallet/deposit")
async def create_deposit(data: DepositIn, request: Request, user: dict = Depends(require_player)):
    if data.amount < 5 or data.amount > 10000:
        raise HTTPException(400, "Amount must be between $5 and $10,000")
    try:
        host = request.headers.get("origin") or request.headers.get("referer") or APP_URL
        webhook_url = f"{APP_URL}/api/wallet/webhook"
        checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        req = CheckoutSessionRequest(
            amount=float(data.amount),
            currency="usd",
            success_url=f"{APP_URL}/wallet/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{APP_URL}/wallet",
            metadata={"user_id": user["id"], "amount_cents": str(int(data.amount * 100))},
        )
        session = await checkout.create_checkout_session(req)
        # Record pending tx
        tx_id = uid()
        await db.wallet_tx.insert_one({
            "id": tx_id, "user_id": user["id"], "type": "deposit",
            "amount": data.amount, "status": "pending",
            "stripe_session_id": session.session_id,
            "created_at": utcnow().isoformat(),
        })
        return {"url": session.url, "session_id": session.session_id, "tx_id": tx_id}
    except Exception as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(500, f"Payment provider error: {str(e)}")

@api.get("/wallet/deposit/status/{session_id}")
async def deposit_status(session_id: str, user: dict = Depends(require_player)):
    """Poll Stripe for session status (used as fallback if webhook not received)."""
    try:
        webhook_url = f"{APP_URL}/api/wallet/webhook"
        checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        status: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)
        tx = await db.wallet_tx.find_one({"stripe_session_id": session_id, "user_id": user["id"]}, {"_id": 0})
        # If paid and tx still pending, credit
        if status.payment_status == "paid" and tx and tx.get("status") == "pending":
            await _credit_deposit(user["id"], tx["amount"], session_id, tx["id"])
            tx["status"] = "completed"
        return {"payment_status": status.payment_status, "status": status.status, "tx": tx}
    except Exception as e:
        raise HTTPException(500, str(e))

async def _credit_deposit(user_id: str, amount: float, session_id: str, tx_id: str):
    # Idempotent credit via unique stripe_session_id + status
    result = await db.wallet_tx.update_one(
        {"id": tx_id, "status": "pending"},
        {"$set": {"status": "completed", "completed_at": utcnow().isoformat()}},
    )
    if result.modified_count > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"wallet_balance": amount}})
        await _notify(user_id, "deposit", f"Deposit of ${amount:.2f} completed", "wallet")

@api.post("/wallet/withdraw")
async def withdraw(data: WithdrawIn, user: dict = Depends(require_player)):
    u = await db.users.find_one({"id": user["id"]})
    balance = u.get("wallet_balance", 0)
    if data.amount < 10:
        raise HTTPException(400, "Minimum withdrawal is $10")
    if data.amount > balance:
        raise HTTPException(400, "Insufficient balance")
    amount_cents = int(round(data.amount * 100))
    wb = calculate_withdrawal_fee(amount_cents, data.speed)
    fee = round(wb.fee_cents / 100, 2)
    net = round(wb.net_cents / 100, 2)
    tx_id = uid()
    # Deduct immediately
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": -data.amount}})
    await db.wallet_tx.insert_one({
        "id": tx_id, "user_id": user["id"], "type": "withdrawal",
        "amount": data.amount, "fee": fee, "net": net,
        "speed": data.speed, "tier": wb.tier_label, "eta": wb.eta_label,
        "bank_account": data.bank_account, "status": "processing",
        "created_at": utcnow().isoformat(),
    })
    # Record fee revenue (only same-day withdrawals generate revenue)
    if fee > 0:
        await db.revenue.insert_one({
            "id": uid(), "type": "withdrawal_fee", "amount": fee,
            "user_id": user["id"], "tx_id": tx_id, "speed": data.speed,
            "tier": wb.tier_label, "created_at": utcnow().isoformat(),
        })
    # Simulate async processing. Same-day settles in 2s, standard "settles" in 5s (mocked; real would be days).
    settle_delay = 2 if data.speed == "same_day" else 5

    async def _complete():
        await asyncio.sleep(settle_delay)
        await db.wallet_tx.update_one({"id": tx_id}, {"$set": {"status": "completed", "completed_at": utcnow().isoformat()}})
        await _notify(user["id"], "withdrawal", f"Withdrawal of ${net:.2f} sent to your bank ({wb.eta_label})", "wallet")
    asyncio.create_task(_complete())
    speed_label = "Same-day" if data.speed == "same_day" else "Standard"
    await _notify(user["id"], "withdrawal", f"{speed_label} withdrawal of ${data.amount:.2f} initiated (fee: ${fee:.2f})", "wallet")
    return {"tx_id": tx_id, "fee": fee, "net": net, "speed": data.speed, "tier": wb.tier_label, "eta": wb.eta_label, "status": "processing"}

@api.post("/wallet/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        webhook_url = f"{APP_URL}/api/wallet/webhook"
        checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        event_data = await checkout.handle_webhook(body, sig)
        # emergentintegrations returns a normalized object with event_type, session_id, payment_status, metadata
        if event_data and event_data.payment_status == "paid":
            session_id = event_data.session_id
            user_id = (event_data.metadata or {}).get("user_id")
            tx = await db.wallet_tx.find_one({"stripe_session_id": session_id}, {"_id": 0})
            if tx and user_id:
                await _credit_deposit(user_id, tx["amount"], session_id, tx["id"])
        return {"ok": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"ok": False, "error": str(e)}

# ============================================================
# CHALLENGES (Head-to-Head)
# ============================================================
@api.post("/challenges")
async def create_challenge(data: ChallengeIn, user: dict = Depends(require_player)):
    u = await db.users.find_one({"id": user["id"]})
    if u.get("wallet_balance", 0) < data.stake:
        raise HTTPException(400, "Insufficient balance for stake")
    # Resolve invited opponent (if any)
    invited_opponent = None
    if data.opponent_username:
        target = await db.users.find_one({"username": data.opponent_username})
        if not target:
            raise HTTPException(404, f"No user found with username '{data.opponent_username}'")
        if target["id"] == user["id"]:
            raise HTTPException(400, "You cannot invite yourself")
        if target.get("suspended"):
            raise HTTPException(400, "That player is not available")
        invited_opponent = target
    ch_id = uid()
    # Lock creator stake
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": -data.stake, "pending_balance": data.stake}})
    doc = {
        "id": ch_id, "creator_id": user["id"], "creator_username": u["username"],
        "opponent_id": (invited_opponent["id"] if invited_opponent else None),
        "opponent_username": (invited_opponent["username"] if invited_opponent else None),
        "game": data.game, "platform": data.platform, "region": data.region,
        "stake": data.stake, "notes": data.notes,
        # invited = private invite awaiting opponent; open = public listing anyone can accept
        "status": ("invited" if invited_opponent else "open"),
        "invited": bool(invited_opponent),
        "results": {}, "winner_id": None,
        "created_at": utcnow().isoformat(),
    }
    await db.challenges.insert_one(doc)
    if invited_opponent:
        await _notify(
            invited_opponent["id"], "challenge_invite",
            f"{u['username']} invited you to a ${data.stake:.2f} {data.game} match",
            "challenge", ch_id,
        )
    return serialize(doc)


@api.post("/challenges/{ch_id}/decline")
async def decline_challenge(ch_id: str, user: dict = Depends(require_player)):
    ch = await db.challenges.find_one({"id": ch_id})
    if not ch:
        raise HTTPException(404, "Not found")
    if ch["status"] != "invited":
        raise HTTPException(400, "Only pending invites can be declined")
    if ch.get("opponent_id") != user["id"]:
        raise HTTPException(403, "Only the invited player can decline")
    # Refund creator stake
    await db.users.update_one({"id": ch["creator_id"]}, {"$inc": {"wallet_balance": ch["stake"], "pending_balance": -ch["stake"]}})
    await db.challenges.update_one({"id": ch_id}, {"$set": {"status": "declined", "declined_at": utcnow().isoformat()}})
    await _notify(ch["creator_id"], "challenge_declined", f"{user['username']} declined your ${ch['stake']:.2f} {ch['game']} invite", "challenge", ch_id)
    return {"ok": True}

@api.get("/challenges")
async def list_challenges(status: Optional[str] = None, game: Optional[str] = None, mine: bool = False, invites: bool = False, user: dict = Depends(current_user)):
    q: dict = {}
    if status:
        q["status"] = status
    if game:
        q["game"] = game
    if invites:
        # Invites received by the current user (private invites awaiting them)
        q["status"] = "invited"
        q["opponent_id"] = user["id"]
    elif mine:
        q["$or"] = [{"creator_id": user["id"]}, {"opponent_id": user["id"]}]
    else:
        # Public listing: never return private invites to non-participants
        if "status" not in q:
            q["status"] = {"$ne": "invited"}
    cursor = db.challenges.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)


@api.get("/users/search")
async def user_search(q: str = "", user: dict = Depends(current_user)):
    """Autocomplete by username prefix. Excludes current user, admin, suspended."""
    query = (q or "").strip()
    if len(query) < 1:
        return []
    import re
    pattern = "^" + re.escape(query)
    cursor = db.users.find(
        {"username": {"$regex": pattern, "$options": "i"},
         "id": {"$ne": user["id"]},
         "is_admin": {"$ne": True},
         "suspended": {"$ne": True}},
        {"_id": 0, "id": 1, "username": 1, "avatar": 1, "stats.rank": 1, "stats.wins": 1},
    ).sort("username", 1).limit(10)
    users = await cursor.to_list(10)
    return [{
        "id": u["id"], "username": u["username"], "avatar": u.get("avatar", ""),
        "rank": u.get("stats", {}).get("rank", 1500),
        "wins": u.get("stats", {}).get("wins", 0),
    } for u in users]

@api.get("/challenges/{ch_id}")
async def get_challenge(ch_id: str, _: dict = Depends(current_user)):
    ch = await db.challenges.find_one({"id": ch_id}, {"_id": 0})
    if not ch:
        raise HTTPException(404, "Not found")
    return ch

@api.post("/challenges/{ch_id}/accept")
async def accept_challenge(ch_id: str, user: dict = Depends(require_player)):
    ch = await db.challenges.find_one({"id": ch_id})
    if not ch:
        raise HTTPException(404, "Not found")
    if ch["status"] not in ("open", "invited"):
        raise HTTPException(400, "Challenge not accepting players")
    if ch["creator_id"] == user["id"]:
        raise HTTPException(400, "Cannot accept own challenge")
    if ch["status"] == "invited" and ch.get("opponent_id") != user["id"]:
        raise HTTPException(403, "This is a private invite")
    u = await db.users.find_one({"id": user["id"]})
    if u.get("wallet_balance", 0) < ch["stake"]:
        raise HTTPException(400, "Insufficient balance for stake")
    # Lock opponent stake
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": -ch["stake"], "pending_balance": ch["stake"]}})
    await db.challenges.update_one({"id": ch_id}, {"$set": {
        "opponent_id": user["id"], "opponent_username": u["username"],
        "status": "matched", "matched_at": utcnow().isoformat(),
    }})
    await _notify(ch["creator_id"], "match_starting", f"{u['username']} accepted your challenge in {ch['game']}!", "challenge", ch_id)
    return {"ok": True}

@api.post("/challenges/{ch_id}/cancel")
async def cancel_challenge(ch_id: str, user: dict = Depends(require_player)):
    ch = await db.challenges.find_one({"id": ch_id})
    if not ch:
        raise HTTPException(404, "Not found")
    if ch["creator_id"] != user["id"]:
        raise HTTPException(403, "Only creator can cancel")
    if ch["status"] not in ("open", "invited"):
        raise HTTPException(400, "Only open or pending-invite challenges can be cancelled")
    # Refund stake
    await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": ch["stake"], "pending_balance": -ch["stake"]}})
    await db.challenges.update_one({"id": ch_id}, {"$set": {"status": "cancelled"}})
    # If it was a private invite, notify the invited opponent that it's been rescinded
    if ch.get("opponent_id") and ch.get("status") == "invited":
        await _notify(ch["opponent_id"], "challenge_invite_cancelled", f"Your {ch['game']} invite was cancelled", "challenge", ch_id)
    return {"ok": True}

@api.post("/challenges/{ch_id}/report")
async def report_result(ch_id: str, data: ChallengeResultIn, user: dict = Depends(require_player)):
    ch = await db.challenges.find_one({"id": ch_id})
    if not ch:
        raise HTTPException(404, "Not found")
    if user["id"] not in (ch["creator_id"], ch["opponent_id"]):
        raise HTTPException(403, "Not a participant")
    if ch["status"] not in ("matched", "reported"):
        raise HTTPException(400, "Cannot report in current status")
    # Normalize reported-winner into a concrete participant id
    if data.winner_id in ("me", user["id"]):
        winner = user["id"]
    elif data.winner_id in (ch["creator_id"], ch["opponent_id"]):
        winner = data.winner_id
    else:
        raise HTTPException(400, "Reported winner must be one of the two participants")

    is_creator = user["id"] == ch["creator_id"]
    column = "creator_reported_winner_id" if is_creator else "opponent_reported_winner_id"

    results = ch.get("results") or {}
    results[user["id"]] = {
        "winner_id": winner,
        "my_score": data.my_score,
        "opponent_score": data.opponent_score,
        "evidence": data.evidence,
        "at": utcnow().isoformat(),
    }
    await db.challenges.update_one({"id": ch_id}, {"$set": {
        "results": results,
        column: winner,
        "status": "reported",
    }})

    # Re-fetch to get both columns after the update
    ch2 = await db.challenges.find_one({"id": ch_id})
    creator_report = ch2.get("creator_reported_winner_id")
    opponent_report = ch2.get("opponent_reported_winner_id")

    if creator_report and opponent_report:
        if creator_report == opponent_report:
            # Both agree → auto-settle
            await _finalize_challenge(ch_id, creator_report)
            return {"status": "settled", "winner_id": creator_report}
        # Disagreement → hold funds, mark disputed, log a dispute row for admin
        await db.challenges.update_one({"id": ch_id}, {"$set": {"status": "disputed", "disputed_at": utcnow().isoformat()}})
        await db.disputes.insert_one({
            "id": uid(), "challenge_id": ch_id, "opened_by": user["id"],
            "reason": "Players reported different match winners",
            "status": "open", "created_at": utcnow().isoformat(),
        })
        await _notify(ch["creator_id"], "support_update", "Match disputed — funds locked, fair play team is reviewing", "challenge", ch_id)
        await _notify(ch["opponent_id"], "support_update", "Match disputed — funds locked, fair play team is reviewing", "challenge", ch_id)
        return {"status": "disputed"}
    return {"status": "waiting"}

async def _finalize_challenge(ch_id: str, winner_id: str):
    ch = await db.challenges.find_one({"id": ch_id})
    if not ch or ch["status"] == "finalized":
        return
    breakdown = calculate_challenge_fee(ch["stake"])
    total_pot = breakdown.pool
    fee = breakdown.service_fee
    payout = breakdown.net_prize
    loser_id = ch["opponent_id"] if winner_id == ch["creator_id"] else ch["creator_id"]
    # Release both pending stakes
    await db.users.update_one({"id": ch["creator_id"]}, {"$inc": {"pending_balance": -ch["stake"]}})
    await db.users.update_one({"id": ch["opponent_id"]}, {"$inc": {"pending_balance": -ch["stake"]}})
    # Payout winner
    await db.users.update_one({"id": winner_id}, {"$inc": {"wallet_balance": payout, "stats.wins": 1, "stats.earnings": payout, "stats.rank": 25, "stats.matches": 1}})
    await db.users.update_one({"id": loser_id}, {"$inc": {"stats.losses": 1, "stats.rank": -15, "stats.matches": 1}})
    await db.challenges.update_one({"id": ch_id}, {"$set": {
        "status": "finalized", "winner_id": winner_id, "payout": payout,
        "platform_fee": fee, "fee_tier": breakdown.tier_label, "fee_rate": breakdown.rate,
        "finalized_at": utcnow().isoformat(),
    }})
    # Log revenue
    await db.revenue.insert_one({
        "id": uid(), "type": "platform_fee", "amount": fee,
        "source": "h2h", "ref_id": ch_id, "pool": total_pot,
        "rate": breakdown.rate, "tier": breakdown.tier_label,
        "created_at": utcnow().isoformat(),
    })
    # Log wallet txs
    await db.wallet_tx.insert_one({
        "id": uid(), "user_id": winner_id, "type": "prize_winning",
        "amount": payout, "status": "completed", "ref_id": ch_id,
        "created_at": utcnow().isoformat(),
    })
    await _notify(winner_id, "prize_payout", f"You won ${payout:.2f} from H2H challenge!", "challenge", ch_id)
    await _notify(loser_id, "match_results", "Challenge finalized. Better luck next time!", "challenge", ch_id)

# ============================================================
# TOURNAMENTS
# ============================================================
@api.post("/tournaments")
async def create_tournament(data: TournamentIn, user: dict = Depends(require_player)):
    t_id = uid()
    doc = {
        "id": t_id, **data.dict(),
        "status": "open", "registered": [], "brackets": [],
        "created_by": user["id"], "created_at": utcnow().isoformat(),
    }
    if not doc.get("start_at"):
        doc["start_at"] = (utcnow() + timedelta(days=1)).isoformat()
    await db.tournaments.insert_one(doc)
    return serialize(doc)

@api.get("/tournaments")
async def list_tournaments(tournament_type: Optional[str] = None, game: Optional[str] = None):
    q = {}
    if tournament_type:
        q["tournament_type"] = tournament_type
    if game:
        q["game"] = game
    cursor = db.tournaments.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    return await cursor.to_list(100)

@api.get("/tournaments/{t_id}")
async def get_tournament(t_id: str):
    t = await db.tournaments.find_one({"id": t_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Not found")
    return t

@api.post("/tournaments/{t_id}/register")
async def register_tournament(t_id: str, user: dict = Depends(require_player)):
    t = await db.tournaments.find_one({"id": t_id})
    if not t:
        raise HTTPException(404, "Not found")
    if t["status"] != "open":
        raise HTTPException(400, "Registration closed")
    if user["id"] in [p["user_id"] for p in t.get("registered", [])]:
        raise HTTPException(400, "Already registered")
    if len(t.get("registered", [])) >= t.get("max_players", 16):
        raise HTTPException(400, "Tournament full")
    u = await db.users.find_one({"id": user["id"]})
    fee = t.get("entry_fee", 0)
    if fee > 0:
        if u.get("wallet_balance", 0) < fee:
            raise HTTPException(400, "Insufficient balance for entry fee")
        await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": -fee}})
        # Full entry fee goes into the prize pool; platform fee is applied on the
        # TOTAL pool (tiered) at final payout.
        await db.tournaments.update_one({"id": t_id}, {"$inc": {"prize_pool": fee}})
        await db.wallet_tx.insert_one({
            "id": uid(), "user_id": user["id"], "type": "tournament_entry",
            "amount": -fee, "status": "completed", "ref_id": t_id,
            "created_at": utcnow().isoformat(),
        })
    await db.tournaments.update_one({"id": t_id}, {"$push": {"registered": {
        "user_id": user["id"], "username": u["username"], "registered_at": utcnow().isoformat(),
    }}})
    await _notify(user["id"], "tournament_registration", f"Registered for {t['name']}!", "tournament", t_id)
    return {"ok": True}

@api.post("/tournaments/{t_id}/start")
async def start_tournament(t_id: str, user: dict = Depends(require_player)):
    t = await db.tournaments.find_one({"id": t_id})
    if not t:
        raise HTTPException(404, "Not found")
    if t["created_by"] != user["id"] and not user.get("is_admin"):
        raise HTTPException(403, "Not authorized")
    # Generate single-elimination bracket with all rounds pre-built
    players = list(t.get("registered", []))
    if len(players) < 2:
        raise HTTPException(400, "Need at least 2 players")
    random.shuffle(players)
    # Pad to power of 2 with None (byes)
    import math
    size = 1
    while size < len(players):
        size *= 2
    padded = players + [None] * (size - len(players))
    # Round 0: seed with padded players
    rounds = []
    round0 = []
    for i in range(0, size, 2):
        p1 = padded[i]
        p2 = padded[i + 1]
        m = {
            "id": uid(), "round": 0, "index": i // 2,
            "p1": p1, "p2": p2,
            "winner_id": None, "reports": {}, "status": "pending",
        }
        # Auto-advance byes
        if p1 and not p2:
            m["winner_id"] = p1["user_id"]
            m["status"] = "finalized"
        elif p2 and not p1:
            m["winner_id"] = p2["user_id"]
            m["status"] = "finalized"
        elif p1 and p2:
            m["status"] = "ready"
        round0.append(m)
    rounds.append(round0)
    # Subsequent rounds: create empty matches, winners fill in as reported
    num_matches = len(round0) // 2
    r = 1
    while num_matches >= 1:
        rnd = []
        for i in range(num_matches):
            rnd.append({
                "id": uid(), "round": r, "index": i,
                "p1": None, "p2": None,
                "winner_id": None, "reports": {}, "status": "pending",
            })
        rounds.append(rnd)
        if num_matches == 1:
            break
        num_matches = num_matches // 2
        r += 1
    # Propagate byes from round 0 into round 1 immediately
    for i, m in enumerate(rounds[0]):
        if m["status"] == "finalized" and m["winner_id"] and len(rounds) > 1:
            next_idx = i // 2
            slot = "p1" if i % 2 == 0 else "p2"
            winner_obj = m["p1"] if m["winner_id"] == (m["p1"] or {}).get("user_id") else m["p2"]
            rounds[1][next_idx][slot] = winner_obj
    # Mark round 1 matches ready if both players known
    for m in rounds[1] if len(rounds) > 1 else []:
        if m["p1"] and m["p2"]:
            m["status"] = "ready"
    await db.tournaments.update_one({"id": t_id}, {"$set": {"status": "in_progress", "brackets": rounds, "started_at": utcnow().isoformat()}})
    # Notify all registered
    for p in players:
        await _notify(p["user_id"], "match_starting", f"{t['name']} has started! Check your bracket.", "tournament", t_id)
    return {"ok": True, "brackets": rounds}


@api.post("/tournaments/{t_id}/report")
async def report_tournament_match(t_id: str, data: TournamentMatchReportIn, user: dict = Depends(require_player)):
    t = await db.tournaments.find_one({"id": t_id})
    if not t:
        raise HTTPException(404, "Not found")
    if t.get("status") != "in_progress":
        raise HTTPException(400, "Tournament not in progress")
    brackets = t.get("brackets", [])
    # Locate match
    match = None
    round_i = match_i = -1
    for ri, rnd in enumerate(brackets):
        for mi, m in enumerate(rnd):
            if m["id"] == data.match_id:
                match, round_i, match_i = m, ri, mi
                break
        if match:
            break
    if not match:
        raise HTTPException(404, "Match not found")
    if match.get("status") == "finalized":
        raise HTTPException(400, "Match already finalized")
    p1 = match.get("p1") or {}
    p2 = match.get("p2") or {}
    if user["id"] not in (p1.get("user_id"), p2.get("user_id")) and not user.get("is_admin"):
        raise HTTPException(403, "Not a participant in this match")
    if data.winner_id not in (p1.get("user_id"), p2.get("user_id")):
        raise HTTPException(400, "Winner must be one of the two players")
    reports = match.get("reports") or {}
    reports[user["id"]] = {
        "winner_id": data.winner_id,
        "my_score": data.my_score,
        "opponent_score": data.opponent_score,
        "evidence": data.evidence,
        "at": utcnow().isoformat(),
    }
    match["reports"] = reports
    # Admin override: finalize immediately
    if user.get("is_admin"):
        await _finalize_tournament_match(t_id, brackets, round_i, match_i, data.winner_id)
        return {"ok": True, "finalized": True}
    # If both participants agreed OR only opponent report matches
    p1_report = reports.get(p1.get("user_id", ""), {}).get("winner_id")
    p2_report = reports.get(p2.get("user_id", ""), {}).get("winner_id")
    if p1_report and p2_report and p1_report == p2_report:
        await _finalize_tournament_match(t_id, brackets, round_i, match_i, p1_report)
        return {"ok": True, "finalized": True}
    if p1_report and p2_report and p1_report != p2_report:
        # Dispute
        match["status"] = "disputed"
        await db.tournaments.update_one({"id": t_id}, {"$set": {"brackets": brackets}})
        for uid_ in (p1.get("user_id"), p2.get("user_id")):
            if uid_:
                await _notify(uid_, "support_update", "Tournament match disputed — awaiting admin review", "tournament", t_id)
        return {"ok": True, "disputed": True}
    match["status"] = "reported"
    await db.tournaments.update_one({"id": t_id}, {"$set": {"brackets": brackets}})
    return {"ok": True, "awaiting_opponent": True}


async def _finalize_tournament_match(t_id: str, brackets: list, round_i: int, match_i: int, winner_id: str):
    match = brackets[round_i][match_i]
    if match.get("status") == "finalized":
        return
    match["status"] = "finalized"
    match["winner_id"] = winner_id
    match["finalized_at"] = utcnow().isoformat()
    p1 = match.get("p1") or {}
    p2 = match.get("p2") or {}
    winner_obj = p1 if p1.get("user_id") == winner_id else p2
    loser_id = p2.get("user_id") if p1.get("user_id") == winner_id else p1.get("user_id")
    # Update stats
    await db.users.update_one({"id": winner_id}, {"$inc": {"stats.wins": 1, "stats.matches": 1, "stats.rank": 10}})
    if loser_id:
        await db.users.update_one({"id": loser_id}, {"$inc": {"stats.losses": 1, "stats.matches": 1, "stats.rank": -5}})
    # Advance winner to next round
    if round_i + 1 < len(brackets):
        next_match = brackets[round_i + 1][match_i // 2]
        slot = "p1" if match_i % 2 == 0 else "p2"
        next_match[slot] = winner_obj
        if next_match.get("p1") and next_match.get("p2"):
            next_match["status"] = "ready"
        await _notify(winner_id, "match_starting", "You advanced to the next round!", "tournament", t_id)
    else:
        # Final round → tournament complete, payout using tiered platform fee on total pool.
        t = await db.tournaments.find_one({"id": t_id})
        prize_pool = t.get("prize_pool", 0)
        breakdown = calculate_fee(prize_pool)
        platform_cut = breakdown.service_fee
        net_prize = breakdown.net_prize
        payout = round(net_prize * 0.7, 2)  # 70% of net to winner
        runner_up_prize = round(net_prize - payout, 2)  # 30% of net to runner-up
        await db.users.update_one({"id": winner_id}, {"$inc": {"wallet_balance": payout, "stats.earnings": payout}})
        await db.wallet_tx.insert_one({
            "id": uid(), "user_id": winner_id, "type": "prize_winning",
            "amount": payout, "status": "completed", "ref_id": t_id,
            "created_at": utcnow().isoformat(),
        })
        if loser_id and runner_up_prize > 0:
            await db.users.update_one({"id": loser_id}, {"$inc": {"wallet_balance": runner_up_prize, "stats.earnings": runner_up_prize}})
            await db.wallet_tx.insert_one({
                "id": uid(), "user_id": loser_id, "type": "prize_winning",
                "amount": runner_up_prize, "status": "completed", "ref_id": t_id,
                "created_at": utcnow().isoformat(),
            })
            await _notify(loser_id, "prize_payout", f"Runner-up! You won ${runner_up_prize:.2f}", "tournament", t_id)
        if platform_cut > 0:
            await db.revenue.insert_one({
                "id": uid(), "type": "tournament_platform_cut", "amount": platform_cut,
                "source": "tournament", "ref_id": t_id, "pool": prize_pool,
                "rate": breakdown.rate, "tier": breakdown.tier_label,
                "created_at": utcnow().isoformat(),
            })
        await db.tournaments.update_one({"id": t_id}, {"$set": {
            "status": "completed", "winner_id": winner_id, "runner_up_id": loser_id,
            "final_payout": payout, "final_runner_up_prize": runner_up_prize,
            "final_platform_fee": platform_cut, "fee_tier": breakdown.tier_label,
            "completed_at": utcnow().isoformat(),
        }})
        await _notify(winner_id, "prize_payout", f"CHAMPION! You won ${payout:.2f}", "tournament", t_id)
    await db.tournaments.update_one({"id": t_id}, {"$set": {"brackets": brackets}})

# ============================================================
# LEADERBOARDS
# ============================================================
@api.get("/leaderboards/global")
async def leaderboard_global(game: Optional[str] = None, limit: int = 50):
    q = {} if not game else {"favorite_games": game}
    cursor = db.users.find(q, {"_id": 0, "password_hash": 0}).sort("stats.rank", -1).limit(limit)
    users = await cursor.to_list(limit)
    return [{"user_id": u["id"], "username": u["username"], "avatar": u.get("avatar", ""),
             "rank": u.get("stats", {}).get("rank", 1500),
             "wins": u.get("stats", {}).get("wins", 0),
             "earnings": u.get("stats", {}).get("earnings", 0)} for u in users]

# ============================================================
# NOTIFICATIONS
# ============================================================
async def _notify(user_id: str, kind: str, message: str, category: str = "general", ref_id: Optional[str] = None):
    await db.notifications.insert_one({
        "id": uid(), "user_id": user_id, "kind": kind, "message": message,
        "category": category, "ref_id": ref_id, "read": False,
        "created_at": utcnow().isoformat(),
    })

@api.get("/notifications")
async def get_notifications(user: dict = Depends(current_user)):
    cursor = db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(50)

@api.post("/notifications/{n_id}/read")
async def mark_read(n_id: str, user: dict = Depends(current_user)):
    await db.notifications.update_one({"id": n_id, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ============================================================
# SUPPORT & REPORTS
# ============================================================
@api.post("/support/tickets")
async def create_ticket(data: TicketIn, user: dict = Depends(current_user)):
    t_id = uid()
    doc = {
        "id": t_id, "user_id": user["id"], "username": user["username"],
        "subject": data.subject, "message": data.message, "category": data.category,
        "status": "open", "messages": [{"from": "user", "text": data.message, "at": utcnow().isoformat()}],
        "created_at": utcnow().isoformat(),
    }
    await db.tickets.insert_one(doc)
    return serialize(doc)

@api.get("/support/tickets")
async def list_tickets(user: dict = Depends(current_user)):
    cursor = db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(100)

@api.post("/support/tickets/{t_id}/message")
async def ticket_reply(t_id: str, data: dict, user: dict = Depends(current_user)):
    text = data.get("text", "")
    if not text:
        raise HTTPException(400, "Empty message")
    await db.tickets.update_one({"id": t_id, "user_id": user["id"]}, {
        "$push": {"messages": {"from": "user", "text": text, "at": utcnow().isoformat()}}
    })
    return {"ok": True}

@api.post("/reports")
async def create_report(data: ReportIn, user: dict = Depends(current_user)):
    r_id = uid()
    await db.reports.insert_one({
        "id": r_id, "reporter_id": user["id"], **data.dict(),
        "status": "open", "created_at": utcnow().isoformat(),
    })
    return {"id": r_id, "ok": True}

@api.get("/rules")
async def rules():
    return {
        "sections": [
            {"title": "Fair Play", "content": "No cheating, no smurfing, no collusion. Violations result in immediate suspension and forfeiture."},
            {"title": "Reporting Results", "content": "Both players must report the winner. Disputes require evidence and admin review."},
            {"title": "Wallet", "content": "Deposits are instant. Standard withdrawals (2–5 business days) are free. Same-day withdrawals use a tiered fee (see below)."},
            {"title": "Tournaments", "content": "Entry fees fund prize pools. Platform service fee is tiered on the total pool: lower rates on bigger events. Late registrations may forfeit their entry."},
            {"title": "1v1 Challenges", "content": "Winner takes the pool minus platform service fee (10% → 5% depending on pool size)."},
        ]
    }

@api.get("/faq")
async def faq():
    return [
        {"q": "How do I deposit funds?", "a": "Go to Wallet → Deposit and choose an amount. Deposits are processed via Stripe."},
        {"q": "When do I get my winnings?", "a": "Prizes are credited immediately after both players report the same winner."},
        {"q": "What's the platform fee?", "a": "Tiered on the total prize pool: 10% ($1–$25), 8% ($26–$100), 6% ($101–$500), 5% ($501+)."},
        {"q": "How do withdrawals work?", "a": "Standard withdrawals (2–5 business days) are FREE. Same-day withdrawals (30 min – 5 hrs) use tiered fees: $1.99–$12.99 flat under $1,000, or 1% above."},
        {"q": "What if there's a dispute?", "a": "Submit evidence in the challenge, and our admin team will review within 48 hours."},
    ]

# ============================================================
# ADS
# ============================================================
@api.get("/ads")
async def get_ads(placement: str = "home"):
    cursor = db.ads.find({"placement": placement, "active": True}, {"_id": 0})
    ads = await cursor.to_list(20)
    if not ads:
        # Fallback default ad
        return [{"id": "default", "title": "Welcome to MatchPoint", "image": "", "link": "", "placement": placement}]
    return ads

@api.post("/admin/ads")
async def create_ad(data: AdIn, _: dict = Depends(require_admin)):
    a_id = uid()
    await db.ads.insert_one({"id": a_id, **data.dict(), "created_at": utcnow().isoformat()})
    return {"id": a_id, "ok": True}

# ============================================================
# ADMIN
# ============================================================
@api.get("/admin/users")
async def admin_users(_: dict = Depends(require_admin)):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).limit(500)
    return await cursor.to_list(500)

@api.post("/admin/users/{user_id}/suspend")
async def admin_suspend(user_id: str, _: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"suspended": True}})
    return {"ok": True}

@api.post("/admin/users/{user_id}/unsuspend")
async def admin_unsuspend(user_id: str, _: dict = Depends(require_admin)):
    await db.users.update_one({"id": user_id}, {"$set": {"suspended": False}})
    return {"ok": True}

@api.get("/admin/disputes")
async def admin_disputes(_: dict = Depends(require_admin)):
    ch_cursor = db.challenges.find({"status": "disputed"}, {"_id": 0})
    challenges = await ch_cursor.to_list(100)
    # Also find tournaments with disputed matches
    # brackets is an array of rounds, each round is an array of matches (nested arrays)
    # so we need nested $elemMatch to match on match.status
    t_cursor = db.tournaments.find(
        {"status": "in_progress",
         "brackets": {"$elemMatch": {"$elemMatch": {"status": "disputed"}}}},
        {"_id": 0},
    )
    tournaments = await t_cursor.to_list(100)
    disputed_matches = []
    for t in tournaments:
        for rnd in t.get("brackets", []):
            for m in rnd:
                if m.get("status") == "disputed":
                    disputed_matches.append({"tournament": {"id": t["id"], "name": t["name"]}, "match": m})
    return {"challenges": challenges, "tournament_matches": disputed_matches}


@api.post("/admin/tournaments/{t_id}/matches/{match_id}/resolve")
async def admin_resolve_tournament_match(t_id: str, match_id: str, data: dict, _: dict = Depends(require_admin)):
    winner_id = data.get("winner_id")
    if not winner_id:
        raise HTTPException(400, "winner_id required")
    t = await db.tournaments.find_one({"id": t_id})
    if not t:
        raise HTTPException(404, "Not found")
    brackets = t.get("brackets", [])
    for ri, rnd in enumerate(brackets):
        for mi, m in enumerate(rnd):
            if m["id"] == match_id:
                await _finalize_tournament_match(t_id, brackets, ri, mi, winner_id)
                return {"ok": True}
    raise HTTPException(404, "Match not found")

@api.post("/admin/disputes/{ch_id}/resolve")
async def admin_resolve_dispute(ch_id: str, data: dict, admin: dict = Depends(require_admin)):
    winner_id = data.get("winner_id")
    note = (data or {}).get("resolution_note") or (data or {}).get("note") or ""
    if not winner_id:
        raise HTTPException(400, "winner_id required")
    await _finalize_challenge(ch_id, winner_id)
    await db.disputes.update_many(
        {"challenge_id": ch_id, "status": "open"},
        {"$set": {"status": "resolved", "resolution": note or f"Resolved — winner: {winner_id}",
                  "resolved_by": admin["username"], "resolved_at": utcnow().isoformat()}},
    )
    return {"ok": True}

@api.get("/admin/analytics")
async def admin_analytics(_: dict = Depends(require_admin)):
    total_users = await db.users.count_documents({})
    total_challenges = await db.challenges.count_documents({})
    finalized = await db.challenges.count_documents({"status": "finalized"})
    tournaments = await db.tournaments.count_documents({})
    pipeline_rev = [{"$group": {"_id": "$type", "total": {"$sum": "$amount"}}}]
    rev = await db.revenue.aggregate(pipeline_rev).to_list(50)
    pipeline_dep = [{"$match": {"type": "deposit", "status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    dep = await db.wallet_tx.aggregate(pipeline_dep).to_list(1)
    pipeline_wd = [{"$match": {"type": "withdrawal", "status": "completed"}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    wd = await db.wallet_tx.aggregate(pipeline_wd).to_list(1)
    return {
        "users": total_users, "challenges": total_challenges,
        "finalized_challenges": finalized, "tournaments": tournaments,
        "revenue_by_type": rev,
        "total_deposits": (dep[0]["total"] if dep else 0),
        "total_withdrawals": (wd[0]["total"] if wd else 0),
    }

@api.get("/admin/revenue")
async def admin_revenue(_: dict = Depends(require_admin)):
    cursor = db.revenue.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(200)


# --------- Company Ops Dashboard ---------

@api.get("/admin/overview")
async def admin_overview(_: dict = Depends(require_admin)):
    """High-level KPIs + 7-day timeseries for the ops dashboard."""
    now = utcnow()
    day_ago = now - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Users
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    new_users_24h = await db.users.count_documents({"created_at": {"$gte": day_ago.isoformat()}, "is_admin": {"$ne": True}})
    new_users_7d = await db.users.count_documents({"created_at": {"$gte": week_ago.isoformat()}, "is_admin": {"$ne": True}})
    suspended = await db.users.count_documents({"suspended": True})

    # Approx DAU/MAU via recent session activity
    dau = len(await db.sessions.distinct("user_id", {"last_seen": {"$gte": day_ago.isoformat()}}))
    mau = len(await db.sessions.distinct("user_id", {"last_seen": {"$gte": month_ago.isoformat()}}))

    # Matches & tournaments
    active_challenges = await db.challenges.count_documents({"status": {"$in": ["open", "invited", "matched", "reported"]}})
    disputed_challenges = await db.challenges.count_documents({"status": "disputed"})
    finalized_challenges = await db.challenges.count_documents({"status": "finalized"})
    active_tournaments = await db.tournaments.count_documents({"status": {"$in": ["open", "in_progress"]}})

    # Money
    dep_all = await db.wallet_tx.aggregate([
        {"$match": {"type": "deposit", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    wd_all = await db.wallet_tx.aggregate([
        {"$match": {"type": "withdrawal", "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
    ]).to_list(1)
    wd_pending = await db.wallet_tx.count_documents({"type": "withdrawal", "status": "processing"})

    revenue_by_type = await db.revenue.aggregate([
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        {"$sort": {"total": -1}},
    ]).to_list(20)
    total_revenue = sum(r["total"] for r in revenue_by_type)
    revenue_24h_docs = await db.revenue.find({"created_at": {"$gte": day_ago.isoformat()}}).to_list(1000)
    revenue_24h = sum(r.get("amount", 0) for r in revenue_24h_docs)
    revenue_7d_docs = await db.revenue.find({"created_at": {"$gte": week_ago.isoformat()}}).to_list(5000)
    revenue_7d = sum(r.get("amount", 0) for r in revenue_7d_docs)

    # Support & fair play
    open_tickets = await db.tickets.count_documents({"status": "open"})
    open_reports = await db.reports.count_documents({"status": "open"})

    # 7-day timeseries buckets (revenue, signups, deposits)
    def _bucket_key(iso: str) -> str:
        return (iso or "")[:10]  # YYYY-MM-DD
    buckets = {(week_ago + timedelta(days=i)).strftime("%Y-%m-%d"): {"revenue": 0.0, "signups": 0, "deposits": 0.0, "withdrawals": 0.0} for i in range(8)}
    for r in revenue_7d_docs:
        k = _bucket_key(r.get("created_at", ""))
        if k in buckets:
            buckets[k]["revenue"] += r.get("amount", 0)
    async for u in db.users.find({"created_at": {"$gte": week_ago.isoformat()}, "is_admin": {"$ne": True}}):
        k = _bucket_key(u.get("created_at", ""))
        if k in buckets:
            buckets[k]["signups"] += 1
    async for tx in db.wallet_tx.find({"created_at": {"$gte": week_ago.isoformat()}, "type": {"$in": ["deposit", "withdrawal"]}, "status": "completed"}):
        k = _bucket_key(tx.get("created_at", ""))
        if k in buckets:
            key = "deposits" if tx["type"] == "deposit" else "withdrawals"
            buckets[k][key] += tx.get("amount", 0)
    timeseries = [{"date": k, **v} for k, v in sorted(buckets.items())]

    for r in revenue_by_type:
        r["type"] = r.pop("_id")

    return {
        "kpis": {
            "total_users": total_users,
            "new_users_24h": new_users_24h,
            "new_users_7d": new_users_7d,
            "suspended_users": suspended,
            "dau": dau, "mau": mau,
            "active_challenges": active_challenges,
            "disputed_challenges": disputed_challenges,
            "finalized_challenges": finalized_challenges,
            "active_tournaments": active_tournaments,
            "total_deposits": (dep_all[0]["total"] if dep_all else 0),
            "deposit_count": (dep_all[0]["count"] if dep_all else 0),
            "total_withdrawals": (wd_all[0]["total"] if wd_all else 0),
            "withdrawal_count": (wd_all[0]["count"] if wd_all else 0),
            "pending_withdrawals": wd_pending,
            "total_revenue": round(total_revenue, 2),
            "revenue_24h": round(revenue_24h, 2),
            "revenue_7d": round(revenue_7d, 2),
            "open_tickets": open_tickets,
            "open_reports": open_reports,
        },
        "revenue_by_type": revenue_by_type,
        "timeseries": timeseries,
    }


@api.get("/admin/transactions")
async def admin_transactions(
    _: dict = Depends(require_admin),
    tx_type: Optional[str] = None,  # deposit / withdrawal / prize_winning / tournament_entry
    status: Optional[str] = None,
    limit: int = 100,
):
    q: dict = {}
    if tx_type:
        q["type"] = tx_type
    if status:
        q["status"] = status
    cursor = db.wallet_tx.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    txs = await cursor.to_list(500)
    # Enrich with username lookup
    user_ids = list({t["user_id"] for t in txs if t.get("user_id")})
    if user_ids:
        users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "email": 1}).to_list(len(user_ids))
        um = {u["id"]: u for u in users}
        for t in txs:
            u = um.get(t.get("user_id"))
            if u:
                t["username"] = u["username"]
                t["email"] = u["email"]
    return txs


@api.get("/admin/tournaments")
async def admin_tournaments(_: dict = Depends(require_admin), status: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.tournaments.find(q, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(200)


@api.get("/admin/challenges")
async def admin_challenges(_: dict = Depends(require_admin), status: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.challenges.find(q, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(200)


# --------- Tickets ---------

@api.get("/admin/tickets")
async def admin_tickets(_: dict = Depends(require_admin), status: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(200)


@api.get("/admin/tickets/{ticket_id}")
async def admin_ticket(ticket_id: str, _: dict = Depends(require_admin)):
    t = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Ticket not found")
    return t


@api.post("/admin/tickets/{ticket_id}/reply")
async def admin_ticket_reply(ticket_id: str, data: dict, admin: dict = Depends(require_admin)):
    text = (data or {}).get("text", "").strip()
    if not text:
        raise HTTPException(400, "Empty message")
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(404, "Ticket not found")
    reply = {"from": "admin", "author": admin["username"], "text": text, "at": utcnow().isoformat()}
    await db.tickets.update_one({"id": ticket_id}, {
        "$push": {"messages": reply},
        "$set": {"status": "answered", "last_admin_reply_at": utcnow().isoformat()},
    })
    await _notify(t["user_id"], "support_update", f"Support replied to your ticket: {t.get('subject', '')}", "support", ticket_id)
    return {"ok": True}


@api.post("/admin/tickets/{ticket_id}/close")
async def admin_ticket_close(ticket_id: str, _: dict = Depends(require_admin)):
    t = await db.tickets.find_one({"id": ticket_id})
    if not t:
        raise HTTPException(404, "Ticket not found")
    await db.tickets.update_one({"id": ticket_id}, {"$set": {"status": "closed", "closed_at": utcnow().isoformat()}})
    await _notify(t["user_id"], "support_update", f"Your support ticket was closed: {t.get('subject', '')}", "support", ticket_id)
    return {"ok": True}


# --------- Reports (Fair Play) ---------

@api.get("/admin/reports")
async def admin_reports(_: dict = Depends(require_admin), status: Optional[str] = None):
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.reports.find(q, {"_id": 0}).sort("created_at", -1).limit(200)
    reports = await cursor.to_list(200)
    # Enrich reporter usernames
    reporter_ids = list({r["reporter_id"] for r in reports if r.get("reporter_id")})
    if reporter_ids:
        users = await db.users.find({"id": {"$in": reporter_ids}}, {"_id": 0, "id": 1, "username": 1}).to_list(len(reporter_ids))
        um = {u["id"]: u["username"] for u in users}
        for r in reports:
            r["reporter_username"] = um.get(r.get("reporter_id"))
    return reports


@api.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, data: dict, admin: dict = Depends(require_admin)):
    action = (data or {}).get("action", "resolved")  # resolved | dismissed | suspended
    note = (data or {}).get("note", "")
    r = await db.reports.find_one({"id": report_id})
    if not r:
        raise HTTPException(404, "Report not found")
    await db.reports.update_one({"id": report_id}, {"$set": {
        "status": action, "resolved_at": utcnow().isoformat(),
        "resolved_by": admin["username"], "resolution_note": note,
    }})
    # If action is 'suspended' and target is a player, suspend that user
    if action == "suspended" and r.get("target_type") == "player" and r.get("target_id"):
        await db.users.update_one({"id": r["target_id"]}, {"$set": {"suspended": True}})
    return {"ok": True}


# --------- Ads listing ---------

@api.get("/admin/ads")
async def admin_ads(_: dict = Depends(require_admin)):
    cursor = db.ads.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(200)


@api.post("/admin/ads/{ad_id}/toggle")
async def admin_ads_toggle(ad_id: str, _: dict = Depends(require_admin)):
    ad = await db.ads.find_one({"id": ad_id})
    if not ad:
        raise HTTPException(404, "Ad not found")
    await db.ads.update_one({"id": ad_id}, {"$set": {"active": not ad.get("active", True)}})
    return {"ok": True, "active": not ad.get("active", True)}


@api.delete("/admin/ads/{ad_id}")
async def admin_ads_delete(ad_id: str, _: dict = Depends(require_admin)):
    await db.ads.delete_one({"id": ad_id})
    return {"ok": True}

# ============================================================
# META
# ============================================================
@api.get("/")
async def root():
    return {"status": "ok", "app": "MatchPoint", "version": "1.0.0"}

@api.get("/meta/games")
async def meta_games():
    return {"games": GAMES, "platforms": PLATFORMS, "regions": REGIONS}


@api.get("/meta/fees")
async def meta_fees():
    return {
        "platform_tiers": [
            {"min_pool": t.min_pool, "max_pool": (None if t.max_pool == float("inf") else t.max_pool),
             "rate": t.rate, "label": t.label} for t in FEE_TIERS
        ],
        "withdrawal_tiers_same_day": [
            {"min_cents": t.min_cents, "max_cents": (None if t.max_cents >= 10**12 else t.max_cents),
             "flat_fee_cents": t.flat_fee_cents, "pct_rate": t.pct_rate, "label": t.label}
            for t in SAME_DAY_WITHDRAWAL_TIERS
        ],
        "withdrawal_speeds": [
            {"key": "standard", "label": "Standard", "eta": "2–5 business days", "fee": "Free"},
            {"key": "same_day", "label": "Same-day", "eta": "Typically 30 min – 5 hours", "fee": "Tiered"},
        ],
    }


@api.get("/meta/fee-preview")
async def fee_preview(pool: float):
    b = calculate_fee(pool)
    return {"pool": b.pool, "rate": b.rate, "tier": b.tier_label, "service_fee": b.service_fee, "net_prize": b.net_prize}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    client.close()

"""MatchPoint tiered fees.

Platform service fee is charged against the TOTAL prize pool (sum of all
entry fees) with lower rates on bigger pools to incentivize larger events.

    Pool size          Rate
    $1     - $25       10%
    $26    - $100       8%
    $101   - $500       6%
    $501+               5%

Withdrawal fees:
    Standard (2-5 business days): FREE
    Same-day (30 min - 5 hours), amount tiers:
        $10   - $50      $1.99
        $51   - $100     $2.99
        $101  - $250     $4.99
        $251  - $500     $7.99
        $501  - $1,000   $12.99
        $1,001+          1% of amount
"""
from dataclasses import dataclass
from typing import List, Literal


@dataclass(frozen=True)
class FeeTier:
    min_pool: float
    max_pool: float  # inclusive; math.inf for top tier
    rate: float
    label: str


FEE_TIERS: List[FeeTier] = [
    FeeTier(0.0, 25.0, 0.10, "$1 – $25"),
    FeeTier(25.01, 100.0, 0.08, "$26 – $100"),
    FeeTier(100.01, 500.0, 0.06, "$101 – $500"),
    FeeTier(500.01, float("inf"), 0.05, "$501+"),
]


def _round2(n: float) -> float:
    return round(n * 100) / 100


def get_fee_tier(pool: float) -> FeeTier:
    p = max(0.0, float(pool or 0))
    for t in FEE_TIERS:
        if t.min_pool <= p <= t.max_pool:
            return t
    return FEE_TIERS[-1]


def get_fee_rate(pool: float) -> float:
    return get_fee_tier(pool).rate


@dataclass
class FeeBreakdown:
    pool: float
    rate: float
    tier_label: str
    service_fee: float
    net_prize: float


def calculate_fee(pool: float) -> FeeBreakdown:
    p = _round2(max(0.0, float(pool or 0)))
    tier = get_fee_tier(p)
    service_fee = _round2(p * tier.rate)
    net_prize = _round2(p - service_fee)
    return FeeBreakdown(pool=p, rate=tier.rate, tier_label=tier.label,
                        service_fee=service_fee, net_prize=net_prize)


def calculate_tournament_fee(entry_fee: float, player_count: int) -> FeeBreakdown:
    pool = _round2(max(0.0, float(entry_fee or 0)) * max(0, int(player_count or 0)))
    return calculate_fee(pool)


def calculate_challenge_fee(entry_amount: float) -> FeeBreakdown:
    """1v1 pool = stake * 2."""
    pool = _round2(max(0.0, float(entry_amount or 0)) * 2)
    return calculate_fee(pool)


# ------------------- Withdrawal tiers -------------------
WithdrawalSpeed = Literal["standard", "same_day"]


@dataclass(frozen=True)
class WithdrawalTier:
    min_cents: int
    max_cents: int  # inclusive; sys.maxsize for top tier
    flat_fee_cents: int  # 0 when using pct_rate
    pct_rate: float  # 0 when using flat
    label: str


SAME_DAY_WITHDRAWAL_TIERS: List[WithdrawalTier] = [
    WithdrawalTier(1000, 5000, 199, 0.0, "$10 – $50"),
    WithdrawalTier(5001, 10000, 299, 0.0, "$51 – $100"),
    WithdrawalTier(10001, 25000, 499, 0.0, "$101 – $250"),
    WithdrawalTier(25001, 50000, 799, 0.0, "$251 – $500"),
    WithdrawalTier(50001, 100000, 1299, 0.0, "$501 – $1,000"),
    WithdrawalTier(100001, 10**12, 0, 0.01, "$1,001+"),
]


@dataclass
class WithdrawalFeeBreakdown:
    speed: str
    gross_cents: int
    fee_cents: int
    net_cents: int
    tier_label: str
    eta_label: str


def calculate_withdrawal_fee(amount_cents: int, speed: str) -> WithdrawalFeeBreakdown:
    gross = max(0, int(amount_cents or 0))
    if speed == "standard":
        return WithdrawalFeeBreakdown(speed="standard", gross_cents=gross,
                                      fee_cents=0, net_cents=gross,
                                      tier_label="Free",
                                      eta_label="2–5 business days")
    tier = next((t for t in SAME_DAY_WITHDRAWAL_TIERS if t.min_cents <= gross <= t.max_cents),
                SAME_DAY_WITHDRAWAL_TIERS[-1])
    if tier.flat_fee_cents > 0:
        fee = tier.flat_fee_cents
    else:
        fee = max(1, round(gross * tier.pct_rate))
    net = max(0, gross - fee)
    return WithdrawalFeeBreakdown(speed="same_day", gross_cents=gross,
                                  fee_cents=fee, net_cents=net,
                                  tier_label=tier.label,
                                  eta_label="Typically 30 minutes – 5 hours")

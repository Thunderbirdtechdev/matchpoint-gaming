/**
 * Module 9 — compliance gates.
 *
 * Two things live here, both of which answer "is this caller allowed to move
 * money right now" for reasons that have nothing to do with their role:
 *
 *   1. Jurisdiction and age  — assertMoneyEligible()
 *   2. Second-factor freshness — assertMfaForSensitiveAction()
 *
 * Both read `security_settings`, so enforcement is a decision an accountable
 * person makes in the app (and which lands in the audit log), not a constant a
 * deploy changes. Module 3 recorded eligibility and deliberately enforced
 * nothing, because enforcing it would have locked out every existing account;
 * the switch is what lets that decision be made without a code change.
 *
 * `.server.ts` — reaches the service-role client, so load it inside a handler:
 *
 *     const { assertMoneyEligible } = await import("@/lib/compliance.server");
 */

import { BLOCKED_COUNTRIES, MIN_AGE, ageInYears } from "./eligibility";

export type SecuritySettings = {
  enforce_blocked_jurisdictions: boolean;
  require_eligibility_confirmed: boolean;
  require_mfa_for_treasury: boolean;
};

/**
 * Defaults used when a key is missing from the table entirely — which happens
 * only if this module ships before its migration is applied.
 *
 * They are the SAFE-TO-SHIP values, not the strict ones. A missing row must not
 * silently switch on a gate that has never been exercised: an unapplied
 * migration would then present as "every deposit is refused" with nothing in
 * the UI explaining why. The migration seeds the real defaults.
 */
const FALLBACK: SecuritySettings = {
  enforce_blocked_jurisdictions: false,
  require_eligibility_confirmed: false,
  require_mfa_for_treasury: false,
};

/**
 * Raised when a caller is authenticated and adequately privileged, but barred
 * by a compliance rule. Distinct from ForbiddenError so the UI can say "you
 * can't do this from where you are" rather than "you lack permission".
 */
export class ComplianceError extends Error {
  readonly code: "blocked_country" | "underage" | "not_verified";
  constructor(code: ComplianceError["code"], message: string) {
    super(message);
    this.name = "ComplianceError";
    this.code = code;
  }
}

/** Raised when the action needs a second factor the current session lacks. */
export class MfaRequiredError extends Error {
  readonly code = "mfa_required";
  constructor(
    message = "This action needs two-factor authentication. Add a second factor in Profile → Security, then sign in again.",
  ) {
    super(message);
    this.name = "MfaRequiredError";
  }
}

/**
 * Read all three switches.
 *
 * Not cached, on purpose. A cache would mean an operator flips enforcement on
 * and the platform keeps accepting the thing they just blocked for as long as
 * the TTL lasts — with no way to tell whether it took. These are three rows
 * behind a primary key, on paths that already make Stripe round trips.
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.from("security_settings").select("key, value");
    if (error) throw new Error(error.message);

    const out = { ...FALLBACK };
    for (const row of (data ?? []) as { key: string; value: unknown }[]) {
      if (row.key in out) {
        (out as Record<string, boolean>)[row.key] = row.value === true || row.value === "true";
      }
    }
    return out;
  } catch (e) {
    console.error("[SECURITY-SETTINGS-READ-FAILED]", e);
    return { ...FALLBACK };
  }
}

/**
 * Gate every money movement: deposits, stakes, and every cash-out route.
 *
 * ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: block an account whose country is
 * simply not on the supported list. Those players may already hold a balance,
 * and refusing their cash-out would trap real money in the platform — a worse
 * outcome than having accepted them, and one the player cannot resolve. Only
 * the sanctioned list and the age floor bar a transaction, and both of those
 * are obligations rather than preferences.
 *
 * Unknown country or unknown date of birth is NOT a block under
 * `enforce_blocked_jurisdictions`. That is what makes the switch safe to ship
 * on: it can only bite an account we positively know to be ineligible. The
 * blanket "must have attested" rule is the separate
 * `require_eligibility_confirmed` switch, which ships off.
 */
export async function assertMoneyEligible(userId: string): Promise<void> {
  const settings = await getSecuritySettings();
  if (!settings.enforce_blocked_jurisdictions && !settings.require_eligibility_confirmed) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("player_verification")
    .select("country, date_of_birth, age_confirmed_at")
    .eq("user_id", userId)
    .maybeSingle();

  const row = data as {
    country: string | null;
    date_of_birth: string | null;
    age_confirmed_at: string | null;
  } | null;

  if (settings.require_eligibility_confirmed && !row?.age_confirmed_at) {
    throw new ComplianceError(
      "not_verified",
      "Confirm your date of birth and country in Profile before moving money.",
    );
  }

  if (!settings.enforce_blocked_jurisdictions) return;

  const country = row?.country?.toUpperCase() ?? null;
  if (country && BLOCKED_COUNTRIES[country]) {
    throw new ComplianceError(
      "blocked_country",
      `MatchPoint can't process transactions for accounts in ${BLOCKED_COUNTRIES[country]}.`,
    );
  }

  if (row?.date_of_birth) {
    const age = ageInYears(row.date_of_birth);
    if (!Number.isNaN(age) && age < MIN_AGE) {
      throw new ComplianceError(
        "underage",
        `You must be at least ${MIN_AGE} to move money on MatchPoint.`,
      );
    }
  }
}

/**
 * Require a verified second factor on the CURRENT session for the highest-risk
 * actions: treasury moves, wallet adjustments, privileged role grants.
 *
 * `aal` is a claim Supabase puts on the access token: `aal1` for a normal
 * password session, `aal2` once the session has cleared an MFA challenge. So
 * this asks whether the person at the keyboard proved possession of the factor
 * during THIS session, which is the question that matters for a stolen token —
 * "has this account enrolled a factor" is not, since a stolen aal1 token from
 * an enrolled account would still pass it.
 *
 * Ships behind a switch that is OFF. The enrolment round trip cannot be
 * exercised from a build environment, and turning this on before any staff
 * member has enrolled would remove the treasury controls from everyone at once.
 */
export async function assertMfaForSensitiveAction(context: {
  claims?: Record<string, unknown> | null;
}): Promise<void> {
  const settings = await getSecuritySettings();
  if (!settings.require_mfa_for_treasury) return;

  const aal = context?.claims?.aal;
  if (aal !== "aal2") throw new MfaRequiredError();
}

/**
 * Deposited money has to be played before it can be taken out.
 *
 * Kevin's decision, and the reasoning is arithmetic. Stripe charges
 * 2.9% + 30¢, so a $10 deposit costs the platform 59¢ before anyone has
 * played anything. That is recovered comfortably by the match fee — a $20 pool
 * returns $2 — but only if the money is actually staked. Deposit, withdraw,
 * repeat is a straight loss on every cycle, and it is also the exact shape of
 * moving money through a platform for reasons that have nothing to do with
 * gaming, which is a problem worth avoiding for more than the 59¢.
 *
 * The bar is deliberately low: ONE stake, ever. Not one settled match, not a
 * proportion of the balance played. Someone who deposits, stakes $10 and wins
 * should be able to take their winnings out immediately, and a rule that made
 * them wait would punish the players the platform wants.
 *
 * `escrow_holds` is the right table to ask. A row appears the moment a stake
 * is debited for a challenge or a tournament, and settlement UPDATES its status
 * rather than deleting it, so the record survives. Status is not filtered on
 * purpose — a released, refunded or still-held stake all mean the same thing
 * here, which is that this person came to play.
 *
 * A free match leaves no hold and so does not count. Entry is $10 minimum now,
 * so that only affects rows created before that floor existed.
 */
export class MustPlayFirstError extends Error {
  readonly code = "must_play_first";
  constructor(
    message = "Play a match before withdrawing. Your balance becomes available to cash out once you've staked in at least one challenge or tournament.",
  ) {
    super(message);
    this.name = "MustPlayFirstError";
  }
}

export async function assertHasPlayed(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("escrow_holds")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  // Fail OPEN on a database error. A withdrawal is a player asking for their
  // own money; refusing it because a check could not run is the wrong way to
  // be wrong, and the balance itself is still verified downstream.
  if (error) {
    console.error("[MUST-PLAY] check failed, allowing withdrawal", error);
    return;
  }

  if (!data?.length) throw new MustPlayFirstError();
}

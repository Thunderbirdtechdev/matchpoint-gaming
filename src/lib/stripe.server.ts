// Server-only Stripe client. Import only from server fns / server routes.
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (key.startsWith("pk_")) {
    throw new Error(
      "STRIPE_SECRET_KEY is set to a publishable key (pk_...). " +
        "Use the SECRET key (sk_test_... or sk_live_...) from https://dashboard.stripe.com/apikeys.",
    );
  }
  if (
    !key.startsWith("sk_test_") &&
    !key.startsWith("sk_live_") &&
    !key.startsWith("rk_test_") &&
    !key.startsWith("rk_live_")
  ) {
    throw new Error(
      `STRIPE_SECRET_KEY has an unexpected format (starts with "${key.slice(0, 7)}"). ` +
        "Expected sk_test_..., sk_live_..., rk_test_..., or rk_live_.... The mk_ key is not a Stripe API secret.",
    );
  }
  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

/**
 * Every signing secret this app will accept.
 *
 * Connect forces two webhook destinations, not one. Stripe routes events by
 * scope: `checkout.session.completed` and the payout events belong to the
 * platform account, while `account.updated` — the only thing that tells us a
 * player finished onboarding — is a CONNECTED account event and is delivered
 * to a separate destination. Two destinations mean two signing secrets, and a
 * verifier that knows only one silently 400s half its traffic.
 *
 * Order matters only for cost: the platform secret is tried first because it
 * carries almost all the volume.
 */
export function getWebhookSecrets(): string[] {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  ]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);

  if (!secrets.length) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return secrets;
}

/** @deprecated Use {@link getWebhookSecrets}. Kept so a single-secret caller still works. */
export function getWebhookSecret(): string {
  return getWebhookSecrets()[0];
}

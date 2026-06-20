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
    !key.startsWith("rk_") &&
    !key.startsWith("mk_")
  ) {
    throw new Error(
      `STRIPE_SECRET_KEY has an unexpected format (starts with "${key.slice(0, 7)}"). ` +
        "Expected sk_test_..., sk_live_..., rk_..., or mk_...",
    );
  }
  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

export function getWebhookSecret(): string {
  const s = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!s) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return s;
}

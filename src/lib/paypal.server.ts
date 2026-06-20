/**
 * PayPal Payouts (Sandbox) helper.
 * Server-only — never import from client modules.
 */

const SANDBOX_BASE = "https://api-m.sandbox.paypal.com";

/** Platform fee on PayPal payouts (2%, min $0.25). */
export const PAYPAL_FEE_RATE = 0.02;
export const PAYPAL_FEE_MIN_CENTS = 25;

export function calcPaypalFeeCents(grossCents: number): number {
  const pct = Math.round(grossCents * PAYPAL_FEE_RATE);
  return Math.max(pct, PAYPAL_FEE_MIN_CENTS);
}

function getCreds() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal credentials are not configured");
  return { id, secret };
}

export function paypalBase() {
  return SANDBOX_BASE;
}

/** Get an OAuth access token from PayPal. */
export async function getPaypalAccessToken(): Promise<string> {
  const { id, secret } = getCreds();
  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch(`${SANDBOX_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PayPal auth failed (${res.status}): ${txt}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export type PayoutItemInput = {
  recipientEmail: string;
  amountCents: number;
  currency: string;
  note?: string;
  senderItemId: string;
};

export type PayoutResponse = {
  batch_header: {
    payout_batch_id: string;
    batch_status: string;
  };
};

/** Create a single-item payout batch. */
export async function createPaypalPayout(item: PayoutItemInput): Promise<PayoutResponse> {
  const token = await getPaypalAccessToken();
  const amount = (item.amountCents / 100).toFixed(2);
  const body = {
    sender_batch_header: {
      sender_batch_id: item.senderItemId,
      email_subject: "You've received a payout from MatchPoint",
      email_message: item.note ?? "Your MatchPoint cash-out has been sent.",
    },
    items: [
      {
        recipient_type: "EMAIL",
        amount: { value: amount, currency: item.currency },
        receiver: item.recipientEmail,
        note: item.note ?? "MatchPoint payout",
        sender_item_id: item.senderItemId,
      },
    ],
  };

  const res = await fetch(`${SANDBOX_BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayPal payout failed (${res.status}): ${text}`);
  }
  return JSON.parse(text) as PayoutResponse;
}

/** Verify a PayPal webhook event. */
export async function verifyPaypalWebhook(opts: {
  headers: Headers;
  rawBody: string;
}): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const token = await getPaypalAccessToken();

  const transmission_id = opts.headers.get("paypal-transmission-id");
  const transmission_time = opts.headers.get("paypal-transmission-time");
  const cert_url = opts.headers.get("paypal-cert-url");
  const auth_algo = opts.headers.get("paypal-auth-algo");
  const transmission_sig = opts.headers.get("paypal-transmission-sig");
  if (!transmission_id || !transmission_time || !cert_url || !auth_algo || !transmission_sig) {
    return false;
  }

  const res = await fetch(`${SANDBOX_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id,
      transmission_time,
      cert_url,
      auth_algo,
      transmission_sig,
      webhook_id: webhookId,
      webhook_event: JSON.parse(opts.rawBody),
    }),
  });
  if (!res.ok) return false;
  const json = (await res.json()) as { verification_status: string };
  return json.verification_status === "SUCCESS";
}

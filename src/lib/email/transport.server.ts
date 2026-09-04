/**
 * Module 10 / client request 12.7 — the email transport.
 *
 * Everything around sending is provider-agnostic and stays exactly where it is:
 * the pgmq queues, the retry and DLQ handling, the rate-limit cooldown, the
 * suppression list, the send log, and the React Email rendering. The provider
 * was the single `sendLovableEmail()` call inside the queue processor. This
 * module is that call, made swappable.
 *
 * ⚠️ THE PROVIDER IS CHOSEN BY ENV VAR, AND THE DEFAULT IS THE OLD ONE.
 *
 * That is not fence-sitting. `auth_emails` — signup confirmation, magic links,
 * password recovery — rides the same queue as everything else. A hard swap to a
 * Resend account whose domain is not verified yet would not merely lose
 * marketing mail: it would lock people out of their accounts, and the people
 * most affected would be the ones who cannot sign in to report it.
 *
 * So: set RESEND_API_KEY and Resend takes over. Remove it and the platform is
 * back on the old transport on the next send, with no deploy. That rollback
 * path is the point.
 *
 * Rollout, in order:
 *   1. Verify a sending domain in the Resend dashboard. It CANNOT be
 *      `notify.matchpointgaming.org` — that subdomain is delegated to Lovable's
 *      nameservers. Use the root domain or a new subdomain.
 *   2. Set RESEND_FROM to a From: address on that verified domain.
 *   3. Set RESEND_API_KEY.
 *   4. Send one test email and confirm it arrives, then watch email_send_log.
 */

/** The queue payload shape, unchanged from what `enqueueAppEmail` writes. */
export type EmailPayload = {
  to: string;
  from: string;
  sender_domain?: string;
  subject: string;
  html: string;
  text?: string;
  purpose?: string;
  label?: string;
  idempotency_key?: string;
  unsubscribe_token?: string;
  message_id?: string;
  run_id?: string;
};

/**
 * Carries the HTTP status through to the caller.
 *
 * The queue processor's `isRateLimited`, `isForbidden` and
 * `getRetryAfterSeconds` duck-type on `status` and `retryAfterSeconds`, which is
 * how the Lovable client's own error shape worked. Matching it here means the
 * whole retry, cooldown and DLQ policy keeps working against Resend without a
 * line of that logic changing.
 */
export class EmailTransportError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly provider: string;

  constructor(
    provider: string,
    status: number,
    message: string,
    retryAfterSeconds: number | null = null,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "EmailTransportError";
    this.provider = provider;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type EmailProvider = "resend" | "lovable";

/** Which provider a send will actually use right now. */
export function activeProvider(): EmailProvider {
  return process.env.RESEND_API_KEY ? "resend" : "lovable";
}

/**
 * The public site origin, for building the unsubscribe link.
 * Falls back to the production domain so a missing env var degrades to a link
 * that works rather than to `undefined/email/unsubscribe`.
 */
function siteOrigin(): string {
  return (
    process.env.SITE_URL ||
    process.env.VITE_SITE_URL ||
    "https://matchpointgaming.org"
  ).replace(/\/$/, "");
}

/**
 * Send through Resend.
 *
 * Two headers matter beyond the obvious:
 *
 * `Idempotency-Key` — the queue guarantees at-least-once delivery, not
 * exactly-once. A message whose visibility timeout expires mid-send gets read
 * again by the next cycle, and without this the player receives the same
 * "you won" email twice. The processor's own duplicate check catches most of
 * it; this closes the window where the send succeeded but the log write had not
 * landed yet.
 *
 * `List-Unsubscribe` with `One-Click` — Gmail and Yahoo require it on bulk
 * mail, and its absence is a deliverability problem rather than a feature gap.
 * The token already exists; the old provider consumed it internally, so this is
 * the one piece of behaviour that has to be rebuilt rather than passed through.
 */
async function sendViaResend(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY!;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (payload.idempotency_key) headers["Idempotency-Key"] = payload.idempotency_key;

  const body: Record<string, unknown> = {
    // RESEND_FROM must be on a domain verified in Resend. The queued `from`
    // was built for the old provider's verified sender, so it is only a
    // fallback — if it is wrong, Resend rejects with a 403 and the message
    // goes to the DLQ rather than silently vanishing.
    from: process.env.RESEND_FROM || payload.from,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
  };
  if (payload.text) body.text = payload.text;

  if (payload.unsubscribe_token) {
    const url = `${siteOrigin()}/email/unsubscribe?token=${encodeURIComponent(payload.unsubscribe_token)}`;
    body.headers = {
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    // A network failure is transient by nature. 503 keeps it in the queue for
    // the next cycle instead of burning a retry against a permanent-error path.
    throw new EmailTransportError("resend", 503, e instanceof Error ? e.message : "network error");
  }

  if (res.ok) return;

  let detail = `HTTP ${res.status}`;
  try {
    const json = (await res.json()) as { message?: string; name?: string };
    if (json?.message) detail = json.message;
    else if (json?.name) detail = json.name;
  } catch {
    /* a non-JSON error body is still an error; the status carries the meaning */
  }

  const retryAfter = res.headers.get("retry-after");
  throw new EmailTransportError(
    "resend",
    res.status,
    detail,
    retryAfter ? Number(retryAfter) || 60 : null,
  );
}

/** The original transport, kept as the fallback and the rollback path. */
async function sendViaLovable(payload: EmailPayload): Promise<void> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    // 403 rather than 500: this is a permanent configuration failure for this
    // message, and the processor routes 403 straight to the DLQ instead of
    // retrying it five times.
    throw new EmailTransportError(
      "lovable",
      403,
      "Neither RESEND_API_KEY nor LOVABLE_API_KEY is set, no email transport is configured.",
    );
  }

  const { sendLovableEmail } = await import("@lovable.dev/email-js");
  await sendLovableEmail(
    {
      run_id: payload.run_id,
      to: payload.to,
      from: payload.from,
      sender_domain: payload.sender_domain,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      purpose: payload.purpose,
      label: payload.label,
      idempotency_key: payload.idempotency_key,
      unsubscribe_token: payload.unsubscribe_token,
      message_id: payload.message_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    { apiKey, sendUrl: process.env.LOVABLE_SEND_URL },
  );
}

/**
 * Send one email through whichever provider is configured.
 *
 * Throws `EmailTransportError` on failure, in the shape the queue processor
 * already knows how to classify.
 */
export async function sendEmail(payload: EmailPayload): Promise<{ provider: EmailProvider }> {
  const provider = activeProvider();
  if (provider === "resend") {
    await sendViaResend(payload);
    return { provider };
  }
  await sendViaLovable(payload);
  return { provider };
}

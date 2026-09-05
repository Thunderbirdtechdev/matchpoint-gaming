/**
 * Get or create the unsubscribe token for an address.
 *
 * The provider REFUSES a transactional send without one — `400
 * missing_unsubscribe: "Transactional emails must include an
 * unsubscribe_token"` — so this is not a courtesy, it is a required field.
 *
 * `/lovable/email/transactional/send` had always done this inline. Module 10's
 * `enqueueAppEmail` did not, which meant every server-triggered notification —
 * match accepted, payout status, dispute opened, staff role granted, security
 * alert — was rejected on arrival and never reached anyone. The queue, the
 * templates and the retry ladder all worked; the message was simply never
 * acceptable to the API.
 *
 * One token per address, reused across sends: that is what makes a single
 * unsubscribe link keep working rather than expiring with the email it arrived
 * in. A token that has been USED is not reissued here — the caller should not
 * be mailing that address at all, and `suppressed_emails` is the check that
 * stops it.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getOrCreateUnsubscribeToken(
  admin: Admin,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const { data: existing, error: lookupError } = await admin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalized)
    .maybeSingle();

  if (lookupError) {
    console.error("[UNSUBSCRIBE] token lookup failed", lookupError);
    return null;
  }
  if (existing?.token) return existing.token as string;

  const token = generateToken();
  const { error: insertError } = await admin
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });

  if (insertError) {
    console.error("[UNSUBSCRIBE] token create failed", insertError);
    return null;
  }

  // A concurrent insert makes our upsert a silent no-op, so the token we
  // generated may not be the one stored. Read back rather than assume.
  const { data: stored } = await admin
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();

  return (stored?.token as string) ?? token;
}

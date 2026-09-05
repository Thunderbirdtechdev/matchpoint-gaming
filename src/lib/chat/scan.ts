/**
 * Spotting an off-platform payment offer as it is typed.
 *
 * A banner at the top of a chat is read once and scrolled past forever. What
 * actually changes behaviour — and what Kevin was pointing at with the Upwork
 * comparison — is a warning that appears at the moment someone types "just Cash
 * App me", addressed to the thing they are doing right now.
 *
 * Shared between client and server on purpose. The client uses it to warn the
 * sender before they commit; the server uses the same function to record what
 * matched, so the moderator queue and the composer can never disagree about
 * whether a message was suspicious.
 *
 * ⚠️ THIS IS A PROMPT, NOT A FILTER. Nothing here blocks a message.
 *
 * Two reasons. Any keyword list is trivially evaded — "c@shapp", "the green
 * app", a screenshot — so blocking buys very little and teaches the determined
 * to write in code, which is worse for moderators than saying it plainly.
 * And the false positives are unavoidable: "I paid the entry with PayPal" is a
 * legitimate sentence about a legitimate deposit. Refusing to send that would
 * make the chat feel broken, and a chat people work around is a chat nobody
 * moderates.
 *
 * So: warn the sender, flag the row, let a human decide.
 */

export type ScanHit =
  | "cash-app"
  | "venmo"
  | "zelle"
  | "paypal"
  | "crypto"
  | "gift-card"
  | "bank-transfer"
  | "phone-number"
  | "off-platform";

/**
 * Ordered most to least specific, because the first hits are the ones worth
 * showing when several match.
 */
const PATTERNS: ReadonlyArray<{ hit: ScanHit; re: RegExp }> = [
  { hit: "cash-app", re: /\bcash\s*[-.]?\s*app\b|\bcashapp\b|\$[a-z][a-z0-9_]{2,}\b/i },
  { hit: "venmo", re: /\bvenmo\b/i },
  { hit: "zelle", re: /\bzelle\b/i },
  { hit: "paypal", re: /\bpay\s*pal\b|\bpaypal\.me\b/i },
  {
    hit: "crypto",
    re: /\b(bitcoin|btc|ethereum|eth|usdt|usdc|crypto\s*wallet|binance|metamask)\b/i,
  },
  { hit: "gift-card", re: /\bgift\s*card\b|\bsteam\s*card\b|\bamazon\s*card\b/i },
  {
    hit: "bank-transfer",
    re: /\b(wire\s*transfer|bank\s*transfer|routing\s*number|account\s*number|iban)\b/i,
  },
  // Deliberately loose: 10+ digits with common separators. A phone number in a
  // match chat is nearly always an attempt to move the conversation elsewhere.
  { hit: "phone-number", re: /(?:\+?\d[\s().-]?){10,}/ },
  {
    hit: "off-platform",
    re: /\b(off[\s-]?(the[\s-]?)?(site|platform|app)|outside\s+the\s+(site|platform|app)|skip\s+the\s+(site|fee)s?)\b/i,
  },
];

/** Every category the text matches, in the order above. */
export function scanForOffPlatform(text: string): ScanHit[] {
  if (!text) return [];
  return PATTERNS.filter((p) => p.re.test(text)).map((p) => p.hit);
}

const LABELS: Record<ScanHit, string> = {
  "cash-app": "Cash App",
  venmo: "Venmo",
  zelle: "Zelle",
  paypal: "PayPal",
  crypto: "cryptocurrency",
  "gift-card": "gift cards",
  "bank-transfer": "a bank transfer",
  "phone-number": "a phone number",
  "off-platform": "settling off the platform",
};

/**
 * The sentence shown to the sender. Names what was spotted, so it reads as a
 * specific observation rather than a generic scold — and stays useful when the
 * match is a false positive, because the player can see exactly what tripped it.
 */
export function offPlatformWarning(hits: ScanHit[]): string | null {
  if (!hits.length) return null;
  const named = LABELS[hits[0]];
  return `It looks like this mentions ${named}. Stakes are only protected while they stay on MatchPoint, and money sent any other way cannot be recovered or disputed. Send it anyway if it is unrelated.`;
}

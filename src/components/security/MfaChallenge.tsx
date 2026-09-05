/**
 * Module 9 — the second factor at SIGN-IN.
 *
 * `TwoFactorCard` enrols a factor and, as a side effect of `mfa.verify`,
 * elevates the session that did the enrolling to AAL2. That made two-factor
 * look finished when it was half built: the next sign-in produced an AAL1
 * session with no way in the app to climb any higher, so every action behind
 * `assertMfaForSensitiveAction` — Stripe sweeps, company withdrawals, wallet
 * credits and privileged role grants — was refused for everyone the moment the
 * enrolling session ended.
 *
 * Supabase does not challenge on its own. `signInWithPassword` succeeds at AAL1
 * whether or not a factor exists; reaching AAL2 requires an explicit
 * challenge/verify round trip, which is what this component is.
 *
 * Whether a challenge is owed is answered by `needsMfaChallenge` in `@/lib/mfa`,
 * which reads `getAuthenticatorAssuranceLevel()` rather than inferring from the
 * factor list. That level reports `nextLevel: "aal2"` exactly when the account
 * has a verified factor and the session has not yet used it, so a reload
 * mid-challenge resumes rather than silently skipping.
 *
 * Skipping is not a security hole. AAL1 is a genuinely signed-in session and
 * always was; declining the challenge just leaves the money actions refused,
 * which is the same answer the server would give anyway. The gate is on the
 * action, never on the page.
 */

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MfaChallenge({
  onVerified,
  onCancel,
}: {
  onVerified: () => void;
  /** Leaves the session at AAL1 rather than signing the user out. */
  onCancel?: () => void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error) return setLoadError(error.message);
      // `totp` holds only verified factors. An unverified one left behind by an
      // abandoned enrolment cannot answer a challenge, so it must not be picked.
      const factor = (data?.totp ?? [])[0];
      if (!factor) return setLoadError("No authenticator app is set up on this account.");
      setFactorId(factor.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw new Error(cErr.message);

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw new Error(vErr.message);

      onVerified();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code was not accepted.");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-surface/40 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Open your authenticator app and enter the current 6-digit code. Staff need this before
          moving money or changing roles.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Six-digit authentication code"
            className="text-center text-lg tracking-[0.4em] tabular-nums"
          />
          <Button
            type="submit"
            disabled={code.length !== 6 || busy || !factorId}
            className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </Button>
        </form>
      )}

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Skip for now, I only need to browse
        </button>
      )}
    </div>
  );
}

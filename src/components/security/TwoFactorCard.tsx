/**
 * Module 9 — TOTP enrolment, for every account rather than staff only.
 *
 * A player's wallet holds real money, so the second factor is worth offering
 * them too; staff simply have actions that can be gated on it.
 *
 * The whole flow runs against the Supabase client in the browser. It has to:
 * `mfa.enroll` returns the TOTP secret, and routing that through our own server
 * would mean the secret existing in a place it does not need to exist.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";

type Enrolling = { factorId: string; qr: string; secret: string } | null;

export function TwoFactorCard() {
  const qc = useQueryClient();
  const [enrolling, setEnrolling] = useState<Enrolling>(null);
  const [code, setCode] = useState("");

  const factorsQ = useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw new Error(error.message);
      // `totp` is already narrowed to verified factors by the client's types;
      // `all` is the one that includes half-finished enrolments.
      return data.totp ?? [];
    },
  });

  /**
   * Enrolment leaves an UNVERIFIED factor behind if the user walks away before
   * entering a code, and Supabase refuses a second factor with the same
   * friendly name. So any stale unverified factor is cleared first — otherwise
   * a user who abandoned the flow once can never start it again.
   */
  const startM = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `MatchPoint ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw new Error(error.message);
      return {
        factorId: data.id,
        qr: data.totp.qr_code,
        secret: data.totp.secret,
      };
    },
    onSuccess: (v) => {
      setEnrolling(v);
      setCode("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyM = useMutation({
    mutationFn: async () => {
      if (!enrolling) throw new Error("Start enrolment first.");
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({
        factorId: enrolling.factorId,
      });
      if (cErr) throw new Error(cErr.message);

      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (vErr) throw new Error(vErr.message);
    },
    onSuccess: () => {
      toast.success("Two-factor authentication is on.");
      setEnrolling(null);
      setCode("");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Second factor removed.");
      qc.invalidateQueries({ queryKey: ["mfa-factors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const verified = factorsQ.data ?? [];

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4" /> Two-factor authentication
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A code from your phone, on top of your password. Recommended for any account holding a
            balance, and required for staff who move money.
          </p>
        </div>
        {verified.length > 0 && <Status variant="success">On</Status>}
      </div>

      {factorsQ.isPending ? (
        <Skeleton className="mt-4 h-20 w-full rounded-xl" />
      ) : verified.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {verified.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface/40 p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{f.friendly_name || "Authenticator app"}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(f.created_at).toLocaleDateString()}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                disabled={removeM.isPending}
                onClick={() => removeM.mutate(f.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : enrolling ? (
        <div className="mt-4 rounded-xl border border-border/50 bg-surface/40 p-4">
          <p className="text-sm font-medium">Scan this with your authenticator app</p>
          <div className="mt-3 flex flex-wrap items-start gap-5">
            {/* The QR arrives as an SVG data URL from Supabase. */}
            <img
              src={enrolling.qr}
              alt="Two-factor setup QR code"
              className="h-40 w-40 rounded-lg bg-white p-2"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Can't scan? Enter this key by hand:</p>
              <code className="mt-1 block break-all rounded-lg border border-border/50 bg-black/30 p-2 text-xs">
                {enrolling.secret}
              </code>

              <form
                className="mt-4 flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  verifyM.mutate();
                }}
              >
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="h-9 w-32 text-sm tabular-nums"
                />
                <Button type="submit" size="sm" disabled={code.length !== 6 || verifyM.isPending}>
                  {verifyM.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Turn on
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEnrolling(null)}
                  disabled={verifyM.isPending}
                >
                  Cancel
                </Button>
              </form>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Keep the key somewhere safe. If you lose the app and the key, only a super admin can
                reset this for you.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border/50 bg-surface/40 p-5">
          <p className="text-sm text-muted-foreground">
            Not set up. You'll need an authenticator app — Google Authenticator, 1Password, Authy or
            similar.
          </p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => startM.mutate()}
            disabled={startM.isPending}
          >
            {startM.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            )}
            Set up two-factor
          </Button>
        </div>
      )}
    </section>
  );
}

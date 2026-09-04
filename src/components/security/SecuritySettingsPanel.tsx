/**
 * Module 9 — the enforcement switches.
 *
 * Each one is a compliance decision, so the UI says what turning it on will
 * actually do to real accounts rather than restating the setting's name. Two of
 * the three ship OFF and are meant to be turned on deliberately, once — the
 * copy is written for the person making that call, not for someone browsing.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getSecuritySettingsForUi, updateSecuritySetting } from "@/lib/security.functions";

type Key =
  | "enforce_blocked_jurisdictions"
  | "require_eligibility_confirmed"
  | "require_mfa_for_treasury";

const COPY: Record<Key, { title: string; on: string; off: string; caution?: string }> = {
  enforce_blocked_jurisdictions: {
    title: "Enforce sanctioned jurisdictions and the age floor",
    on: "Deposits, stakes and cash-outs are refused for accounts that record a sanctioned country or a date of birth under 18.",
    off: "Sanctioned-country and under-age accounts can move money freely.",
    caution:
      "Only bites an account whose country or date of birth is actually on file, an account that has never completed onboarding is unaffected either way.",
  },
  require_eligibility_confirmed: {
    title: "Require confirmed eligibility before any money movement",
    on: "Every player must have completed the eligibility attestation before depositing, staking or cashing out.",
    off: "Players can move money without ever having confirmed their age or country.",
    caution:
      "This one locks out every account that has not been through onboarding, including existing ones. Check who that is before switching it on.",
  },
  require_mfa_for_treasury: {
    title: "Require two-factor for treasury actions",
    on: "Stripe sweeps, company withdrawals, wallet adjustments and privileged role grants need a second factor on the current session.",
    off: "Treasury actions need only a password session.",
    caution:
      "Staff must enrol a second factor first (Profile → Security). Switching this on beforehand removes the treasury controls from everyone at once, including you.",
  },
};

export function SecuritySettingsPanel({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const read = useServerFn(getSecuritySettingsForUi);
  const write = useServerFn(updateSecuritySetting);

  const settingsQ = useQuery({
    queryKey: ["security-settings"],
    queryFn: () => read({}),
  });

  const saveM = useMutation({
    mutationFn: (v: { key: Key; value: boolean }) => write({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(`${COPY[v.key].title}, ${v.value ? "on" : "off"}`);
      qc.invalidateQueries({ queryKey: ["security-settings"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="h-4 w-4" /> Enforcement
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {canEdit
          ? "Every change here is recorded in the audit log below, with your name on it."
          : "Read-only, changing these needs the super admin role."}
      </p>

      {settingsQ.isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : settingsQ.error ? (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load the switches. {(settingsQ.error as Error).message}
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {(settingsQ.data ?? []).map((s) => {
            const copy = COPY[s.key as Key];
            if (!copy) return null;
            const pending = saveM.isPending && saveM.variables?.key === s.key;

            return (
              <li key={s.key} className="rounded-xl border border-border/50 bg-surface/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{copy.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.value ? copy.on : copy.off}
                    </p>
                    {copy.caution && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-orange-300/90">
                        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                        {copy.caution}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <Switch
                      checked={s.value}
                      disabled={!canEdit || saveM.isPending}
                      onCheckedChange={(v) => saveM.mutate({ key: s.key as Key, value: v })}
                      aria-label={copy.title}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

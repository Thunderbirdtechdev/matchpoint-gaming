/**
 * Module 9 — the suspicious-activity queue.
 *
 * Every design choice here is aimed at one failure: a queue nobody reads. A
 * findings list that shows the same thing every day, or that resurrects what
 * someone already judged, gets ignored — and then the one real finding is
 * ignored with it. So dismissal sticks (the scanner remembers the magnitude it
 * was dismissed at), and the queue defaults to open items only.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, RefreshCw, ShieldAlert, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";
import { IconTile } from "@/components/ui/icon-tile";
import { listSecurityFlags, runSecurityScan, triageSecurityFlag } from "@/lib/security.functions";

type FlagStatus = "open" | "acknowledged" | "dismissed" | "actioned";

const STATUS_TABS: { id: FlagStatus | "all"; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "acknowledged", label: "Acknowledged" },
  { id: "actioned", label: "Actioned" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

const SEVERITY_VARIANT = {
  high: "error",
  medium: "warning",
  low: "info",
} as const;

/** What each detector looks for, in a sentence — shown so a reviewer knows why they are looking. */
const KIND_EXPLAINER: Record<string, string> = {
  rapid_cashout:
    "Money deposited and withdrawn inside a day. The shape of laundering, and of a stolen card being cashed out before the chargeback lands.",
  shared_payout_handle:
    "Several accounts paying out to one destination. Usually multi-accounting — one person running several players.",
  repeat_disputes:
    "One player opening disputes repeatedly. Either they are being cheated, or they are working the dispute process.",
  collusion_pair:
    "The same two accounts playing each other over and over with a lopsided result. Match-fixing to move money between accounts.",
  self_dealing:
    "A staff account taking a privileged action on its own account. There is no benign version of this one.",
  blocked_jurisdiction: "The account records a country MatchPoint does not serve.",
  underage: "The account records a date of birth below the age floor.",
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function FlagQueue({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<FlagStatus | "all">("open");
  const qc = useQueryClient();

  const list = useServerFn(listSecurityFlags);
  const scan = useServerFn(runSecurityScan);
  const triage = useServerFn(triageSecurityFlag);

  const flagsQ = useQuery({
    queryKey: ["security-flags", status],
    queryFn: () => list({ data: { status, limit: 100 } }),
  });

  const scanM = useMutation({
    mutationFn: () => scan({}),
    onSuccess: (r) => {
      toast.success(
        r.recorded === 0
          ? "Scan complete — nothing suspicious found."
          : `Scan complete — ${r.recorded} finding${r.recorded === 1 ? "" : "s"} recorded.`,
      );
      if (r.failures.length) {
        toast.error(`${r.failures.length} finding(s) could not be recorded. Check the server log.`);
      }
      qc.invalidateQueries({ queryKey: ["security-flags"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const triageM = useMutation({
    mutationFn: (v: { id: string; status: FlagStatus }) => triage({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["security-flags"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flags = flagsQ.data?.flags ?? [];
  const names = flagsQ.data?.names ?? {};

  const nameOf = (id: string) => names[id] ?? `${id.slice(0, 8)}…`;

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldAlert className="h-4 w-4" /> Suspicious activity
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Detectors run when someone asks them to — there is no scheduler in this stack, and a
            queue that implied continuous monitoring would be lying about what it does.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => scanM.mutate()} disabled={scanM.isPending}>
            {scanM.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Run scan
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1 rounded-lg border border-border/60 bg-surface/40 p-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              status === t.id
                ? "bg-primary/20 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {flagsQ.isPending ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : flagsQ.error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="mb-1 h-4 w-4" />
          <p>Could not load the queue. {(flagsQ.error as Error).message}</p>
        </div>
      ) : !flags.length ? (
        <div className="mt-4 rounded-xl border border-border/50 bg-surface/40 p-8 text-center">
          <IconTile size="lg" className="mx-auto">
            <Check className="h-6 w-6 text-muted-foreground" />
          </IconTile>
          <p className="mt-3 text-sm font-medium">
            {status === "open" ? "Nothing open" : "Nothing here"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {/* Explicit about which of the two it is. "No findings" next to a
                scan that has never run is the same words meaning something
                completely different. */}
            Either the detectors found nothing, or the scan has not been run yet — the audit log
            below records every run.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {flags.map((f) => {
            const detail = (f.detail ?? {}) as Record<string, unknown>;
            const involved = Array.isArray(detail.user_ids)
              ? (detail.user_ids as string[])
              : f.subject_user_id
                ? [f.subject_user_id]
                : [];

            return (
              <li
                key={f.id}
                className="rounded-xl border border-border/50 bg-surface/40 p-4 transition-colors hover:border-border"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Status variant={SEVERITY_VARIANT[f.severity] ?? "default"}>
                        {f.severity}
                      </Status>
                      <span className="text-sm font-semibold">{f.title}</span>
                      {f.status !== "open" && <Status variant="default">{f.status}</Status>}
                    </div>

                    {involved.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {involved.length === 1 ? "Account: " : "Accounts: "}
                        <span className="font-medium text-foreground">
                          {involved.map(nameOf).join(", ")}
                        </span>
                      </p>
                    )}

                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {KIND_EXPLAINER[f.kind] ?? f.kind}
                    </p>

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      First seen {ago(f.first_seen_at)} · last seen {ago(f.last_seen_at)} · seen{" "}
                      {f.seen_count}×{f.resolution_note ? ` · note: ${f.resolution_note}` : ""}
                    </p>
                  </div>

                  {canManage && f.status === "open" && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={triageM.isPending}
                        onClick={() => triageM.mutate({ id: f.id, status: "acknowledged" })}
                      >
                        Looking into it
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={triageM.isPending}
                        onClick={() => triageM.mutate({ id: f.id, status: "dismissed" })}
                        title="Dismiss. It will come back only if it grows."
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {canManage && f.status === "acknowledged" && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={triageM.isPending}
                        onClick={() => triageM.mutate({ id: f.id, status: "actioned" })}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" /> Actioned
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={triageM.isPending}
                        onClick={() => triageM.mutate({ id: f.id, status: "dismissed" })}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-border/40 pt-3 text-[11px]">
                  {Object.entries(detail)
                    .filter(([k]) => k !== "user_ids")
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-1.5">
                        <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                        <dd className="font-medium">
                          {typeof v === "object" ? JSON.stringify(v) : String(v)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

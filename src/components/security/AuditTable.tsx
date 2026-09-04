/**
 * Module 9 — the audit log viewer.
 *
 * Reads like a ledger rather than a table of ids: every row leads with what
 * happened in a sentence, and the ids sit underneath for whoever needs to chase
 * one. Filtering is by lane because that is how the question actually arrives —
 * "what did anyone do to the money last week", not "show me action
 * finance.stripe_sweep".
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, FileClock, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";
import { listAuditLog, type AuditRow } from "@/lib/security.functions";
import { toCsv, csvAmount, csvDate, downloadCsv, type CsvColumn } from "@/lib/csv";

type Lane = "all" | "finance" | "moderation" | "roles" | "promo" | "security";

const LANES: { id: Lane; label: string }[] = [
  { id: "all", label: "Everything" },
  { id: "finance", label: "Money" },
  { id: "moderation", label: "Moderation" },
  { id: "roles", label: "Roles" },
  { id: "security", label: "Security" },
  { id: "promo", label: "Promos" },
];

const LANE_VARIANT: Record<string, "error" | "warning" | "info" | "brand" | "default"> = {
  finance: "warning",
  moderation: "info",
  roles: "brand",
  security: "error",
  promo: "default",
};

const COLUMNS: CsvColumn<AuditRow>[] = [
  { header: "When (UTC)", value: (r) => csvDate(r.created_at) },
  { header: "Actor", value: (r) => r.actor_label ?? r.actor_id },
  { header: "Actor roles", value: (r) => (r.actor_roles ?? []).join(" / ") },
  { header: "Action", value: (r) => r.action },
  { header: "Summary", value: (r) => r.summary },
  {
    header: "Amount (USD)",
    value: (r) => (r.amount_cents == null ? "" : csvAmount(r.amount_cents)),
  },
  { header: "Target type", value: (r) => r.target_type },
  { header: "Target", value: (r) => r.target_label ?? r.target_id },
  { header: "IP", value: (r) => r.ip },
  { header: "Entry ID", value: (r) => r.id },
];

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AuditTable() {
  const [lane, setLane] = useState<Lane>("all");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [cursor, setCursor] = useState<number | undefined>(undefined);

  const list = useServerFn(listAuditLog);

  const logQ = useQuery({
    queryKey: ["audit-log", lane, applied, cursor],
    queryFn: () =>
      list({
        data: {
          lane,
          search: applied || undefined,
          before_id: cursor,
          limit: 50,
        },
      }),
  });

  const rows = logQ.data?.rows ?? [];

  return (
    <section className="rounded-2xl border border-border/60 bg-gradient-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FileClock className="h-4 w-4" /> Audit log
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Append-only. Entries cannot be edited or deleted by anyone, including whoever holds the
            service key.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            downloadCsv(
              `audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(rows, COLUMNS),
            )
          }
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> Export page
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-surface/40 p-1">
          {LANES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                setLane(l.id);
                setCursor(undefined);
              }}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                lane === l.id
                  ? "bg-primary/20 font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(search.trim());
            setCursor(undefined);
          }}
        >
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search what happened…"
            className="h-8 max-w-xs text-xs"
          />
          <Button type="submit" size="sm" variant="ghost">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>
      </div>

      {logQ.isPending ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : logQ.error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertTriangle className="mb-1 h-4 w-4" />
          <p>
            {/* Named specifically, because "relation does not exist" is the one
                failure here with an obvious fix. */}
            {(logQ.error as Error).message.includes("audit_log")
              ? "The audit tables are not installed yet — run 20260904210000_security_audit_and_compliance.sql in the Lovable SQL editor."
              : `Could not load the log. ${(logQ.error as Error).message}`}
          </p>
        </div>
      ) : !rows.length ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nothing recorded{applied || lane !== "all" ? " for this filter" : " yet"}.
        </p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3">
                <Status
                  variant={LANE_VARIANT[r.action.split(".")[0]] ?? "default"}
                  className="mt-0.5 shrink-0"
                >
                  {r.action.split(".")[0]}
                </Status>

                <div className="min-w-0 flex-1">
                  <p className="text-sm">{r.summary}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {r.actor_label ?? (r.actor_id ? `${r.actor_id.slice(0, 8)}…` : "System")}
                    {r.actor_roles?.length ? ` (${r.actor_roles.join(", ")})` : ""} · {r.action}
                    {r.target_label ? ` · ${r.target_label}` : ""}
                    {r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {r.amount_cents != null && (
                    <p className="text-sm font-semibold tabular-nums">
                      ${(r.amount_cents / 100).toFixed(2)}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">{when(r.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {rows.length} entr{rows.length === 1 ? "y" : "ies"}
              {cursor ? " on this page" : ""}
            </p>
            <div className="flex gap-2">
              {cursor && (
                <Button size="sm" variant="ghost" onClick={() => setCursor(undefined)}>
                  Back to newest
                </Button>
              )}
              {logQ.data?.has_more && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCursor(logQ.data!.next_cursor ?? undefined)}
                >
                  Older
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

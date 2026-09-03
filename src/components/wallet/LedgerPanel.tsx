import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

import { getWalletLedger } from "@/lib/wallet.functions";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Status } from "@/components/ui/status";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEDGER_TYPES, TYPE_LABELS, typeLabel, typeHint, fmtCents } from "./ledger";

const STATUSES = ["all", "pending", "completed", "failed", "reversed"] as const;

const statusVariant: Record<string, "success" | "warning" | "error" | "default"> = {
  completed: "success",
  pending: "warning",
  failed: "error",
  reversed: "default",
};

export function LedgerPanel() {
  const fetchLedger = useServerFn(getWalletLedger);
  const [page, setPage] = useState(0);
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["wallet-ledger", page, type, status],
    queryFn: async () =>
      await fetchLedger({
        data: {
          page,
          page_size: 20,
          type: type as (typeof LEDGER_TYPES)[number] | "all",
          status: status as (typeof STATUSES)[number],
        },
      }),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;
  const total = data?.total ?? 0;

  function reset(setter: (v: string) => void) {
    return (v: string) => {
      setter(v);
      setPage(0); // a filter change invalidates the current page offset
    };
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
        <div>
          <h3 className="text-sm font-semibold">Transaction history</h3>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${total} ${total === 1 ? "entry" : "entries"}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={type} onValueChange={reset(setType)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {LEDGER_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={reset(setStatus)}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s[0].toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="grid place-items-center px-6 py-16 text-center">
          <IconTile size="lg">
            <Receipt className="h-5 w-5" />
          </IconTile>
          <p className="mt-4 text-sm text-muted-foreground">
            {type !== "all" || status !== "all"
              ? "No transactions match those filters."
              : "No transactions yet. Deposit funds to get started."}
          </p>
        </div>
      ) : (
        <ul className={`divide-y divide-border/60 ${isFetching ? "opacity-60" : ""}`}>
          {items.map((t) => {
            const meta = (t.metadata as Record<string, unknown> | null) ?? {};
            const feeCents = typeof meta.fee_cents === "number" ? meta.fee_cents : null;
            const netCents = typeof meta.net_cents === "number" ? meta.net_cents : null;
            const recipient =
              typeof meta.recipient_email === "string" ? meta.recipient_email : null;

            // platform_fee rows carry amount_cents = 0 because the fee is bundled into
            // the withdrawal debit; show the collected amount so it isn't a $0.00 row.
            const isFeeRow = t.type === "platform_fee";
            const displayCents = isFeeRow && feeCents !== null ? -feeCents : t.amount_cents;
            const credit = displayCents >= 0;
            const hint = typeHint(t.type);

            return (
              <li key={t.id} className="flex items-start justify-between gap-4 px-6 py-3.5 text-sm">
                <div className="flex min-w-0 items-start gap-3">
                  {credit ? (
                    <ArrowDownCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium">{typeLabel(t.type)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                      {t.description ? ` · ${t.description}` : hint ? ` · ${hint}` : ""}
                    </div>
                    {!isFeeRow && feeCents !== null && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Fee {fmtCents(feeCents)}
                        {netCents !== null && <> · Net {fmtCents(netCents)}</>}
                        {recipient && <> · → {recipient}</>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div
                    className={
                      credit ? "font-medium text-emerald-500" : "font-medium text-rose-500"
                    }
                  >
                    {credit ? "+" : "−"}
                    {fmtCents(displayCents)}
                  </div>
                  <div className="mt-1 flex justify-end">
                    <Status
                      variant={statusVariant[t.status] ?? "default"}
                      className="px-2 py-0 text-[10px]"
                    >
                      {t.status}
                    </Status>
                  </div>
                  {t.balance_after_cents !== null && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Balance {fmtCents(Number(t.balance_after_cents))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/60 px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0 || isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages - 1 || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

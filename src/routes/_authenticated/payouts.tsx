import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Banknote, Copy, Check, X, Clock, RefreshCw, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { adminListPayoutRequests, adminUpdatePayoutRequest } from "@/lib/payouts.functions";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => ({ meta: [{ title: "Payouts — MatchPoint" }] }),
  component: PayoutsPage,
});

type PayoutRow = {
  id: string;
  user_id: string;
  method: "paypal" | "cashapp";
  speed: "standard" | "same_day";
  handle: string;
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  status: "pending" | "processing" | "paid" | "failed" | "canceled";
  admin_note: string | null;
  processed_at: string | null;
  created_at: string;
  profiles?: { username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};

function PayoutsPage() {
  const { user } = useAuth();
  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", user!.id)).data?.map((r) => r.role) ?? [],
  });
  const isAdmin = roles?.includes("admin");

  if (roles && !isAdmin) {
    return (
      <DashboardShell title="Payouts">
        <p className="text-sm text-muted-foreground">You don't have access to payout management.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Payout Management" subtitle="Review, process and authorize player withdrawals.">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>
      <PayoutsManager />
    </DashboardShell>
  );
}

function PayoutsManager() {
  const [speed, setSpeed] = useState<"same_day" | "standard">("same_day");
  const listFn = useServerFn(adminListPayoutRequests);
  const qc = useQueryClient();

  const [sameResult, standardResult] = useQueries({
    queries: [
      {
        queryKey: ["admin-payouts", "same_day"],
        queryFn: () => listFn({ data: { speed: "same_day", limit: 100 } }) as Promise<PayoutRow[]>,
        refetchInterval: 30_000,
      },
      {
        queryKey: ["admin-payouts", "standard"],
        queryFn: () => listFn({ data: { speed: "standard", limit: 100 } }) as Promise<PayoutRow[]>,
        refetchInterval: 30_000,
      },
    ],
  });

  const isFetching = sameResult.isFetching || standardResult.isFetching;
  const refetch = () => qc.invalidateQueries({ queryKey: ["admin-payouts"] });

  const sameRows = sameResult.data ?? [];
  const standardRows = standardResult.data ?? [];

  const samePending = sameRows.filter((r) => r.status === "pending" || r.status === "processing");
  const standardPending = standardRows.filter((r) => r.status === "pending" || r.status === "processing");

  const sameOwed = samePending.reduce((sum, r) => sum + r.net_cents, 0);
  const standardOwed = standardPending.reduce((sum, r) => sum + r.net_cents, 0);
  const totalOwed = sameOwed + standardOwed;

  const data = speed === "same_day" ? sameRows : standardRows;
  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending" || r.status === "processing");
  const history = rows.filter((r) => r.status !== "pending" && r.status !== "processing");
  const owed = speed === "same_day" ? sameOwed : standardOwed;

  const speedLabel = speed === "same_day" ? "Same-day" : "Standard";
  const speedHint = speed === "same_day" ? "30 min – 5 hr SLA" : "2–5 business days SLA";

  return (
    <div className="space-y-6">
      {/* Summary bar — always visible, both queues */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard label="Same-day queue" pending={samePending.length} owed={sameOwed} hint="30 min – 5 hr SLA" />
        <QueueCard label="Standard queue" pending={standardPending.length} owed={standardOwed} hint="2–5 business days SLA" />
        <div className="rounded-2xl border border-border/60 bg-card p-5 sm:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total owed across both queues</div>
              <div className="mt-1 text-3xl font-bold tabular-nums">${(totalOwed / 100).toFixed(2)}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={refetch} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs with detailed lists */}
      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 p-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Banknote className="h-4 w-4" /> Payout queues
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pay the user with the handle shown, then mark the request paid. Rejecting refunds their wallet.
            </p>
          </div>
        </div>

        <div className="p-6">
          <Tabs value={speed} onValueChange={(v) => setSpeed(v as "same_day" | "standard")}>
            <TabsList>
              <TabsTrigger value="same_day" className="flex items-center gap-1.5">
                Same-day
                {samePending.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                    {samePending.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="standard" className="flex items-center gap-1.5">
                Standard
                {standardPending.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                    {standardPending.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={speed} className="mt-5 space-y-6">
              {sameResult.isLoading || standardResult.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading payout requests…
                </div>
              ) : (
                <>
                  <StatRow label={`Awaiting action — ${speedLabel}`} value={String(pending.length)} sub={speedHint} />
                  <PayoutSection title="Awaiting action" count={pending.length} rows={pending} actionable emptyHint="You're all caught up." onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })} />
                  <PayoutSection title="Recent history" count={history.length} rows={history} actionable={false} emptyHint="No completed payouts yet." onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })} />
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function QueueCard({ label, pending, owed, hint }: { label: string; pending: number; owed: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <div className="text-3xl font-bold tabular-nums">{pending}</div>
        <div className="text-sm text-muted-foreground">pending</div>
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">${(owed / 100).toFixed(2)} owed</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline justify-between rounded-xl border border-border/60 bg-surface/30 p-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PayoutSection({
  title,
  count,
  rows,
  actionable,
  emptyHint,
  onChanged,
}: {
  title: string;
  count: number;
  rows: PayoutRow[];
  actionable: boolean;
  emptyHint: string;
  onChanged: () => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <PayoutCard key={r.id} row={r} actionable={actionable} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function statusBadge(status: PayoutRow["status"]) {
  const map: Record<PayoutRow["status"], { label: string; className: string; icon?: React.ReactNode }> = {
    pending: { label: "Pending", className: "bg-amber-500/15 text-amber-300 border-amber-500/30", icon: <Clock className="h-3 w-3" /> },
    processing: { label: "Processing", className: "bg-blue-500/15 text-blue-300 border-blue-500/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    paid: { label: "Paid", className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", icon: <Check className="h-3 w-3" /> },
    failed: { label: "Failed", className: "bg-red-500/15 text-red-300 border-red-500/30", icon: <X className="h-3 w-3" /> },
    canceled: { label: "Canceled", className: "bg-muted text-muted-foreground border-border", icon: <X className="h-3 w-3" /> },
  };
  const s = map[status];
  return (
    <Badge variant="outline" className={`gap-1 ${s.className}`}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

function PayoutCard({ row, actionable, onChanged }: { row: PayoutRow; actionable: boolean; onChanged: () => void }) {
  const updateFn = useServerFn(adminUpdatePayoutRequest);
  const [note, setNote] = useState("");
  const [openNote, setOpenNote] = useState(false);

  const mut = useMutation({
    mutationFn: (action: "mark_processing" | "mark_paid" | "reject") =>
      updateFn({ data: { id: row.id, action, admin_note: note.trim() || undefined } }),
    onSuccess: (res) => {
      toast.success(`Payout ${res.status}.`);
      setNote("");
      setOpenNote(false);
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Update failed"),
  });

  const player = row.profiles?.display_name ?? row.profiles?.username ?? row.user_id.slice(0, 8);
  const initials = player.slice(0, 2).toUpperCase();
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-surface/30 transition hover:border-border">
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        {/* Left: player + handle */}
        <div className="flex min-w-0 items-center gap-3">
          {row.profiles?.avatar_url ? (
            <img src={row.profiles.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{player}</div>
              {statusBadge(row.status)}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              {row.profiles?.username && <span>@{row.profiles.username}</span>}
              <span>•</span>
              <span>{timeAgo(row.created_at)}</span>
              <span>•</span>
              <span className="uppercase">{row.method === "paypal" ? "PayPal" : "Cash App"}</span>
            </div>
            <button
              type="button"
              onClick={() => copy(row.handle)}
              className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-md bg-black/30 px-2 py-1 font-mono text-[11px] hover:bg-black/50"
              title="Copy handle"
            >
              <span className="truncate">{row.handle}</span>
              <Copy className="h-3 w-3 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Middle: amounts */}
        <div className="flex items-center gap-6 md:gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Gross</div>
            <div className="text-sm tabular-nums text-muted-foreground">${(row.amount_cents / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Fee</div>
            <div className="text-sm tabular-nums text-muted-foreground">${(row.fee_cents / 100).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-muted-foreground">Net to pay</div>
            <div className="text-lg font-semibold tabular-nums text-foreground">${(row.net_cents / 100).toFixed(2)}</div>
          </div>
        </div>

        {/* Right: actions */}
        {actionable && (
          <div className="flex flex-wrap items-center gap-2">
            {row.status === "pending" && (
              <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("mark_processing")}>
                Processing
              </Button>
            )}
            <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate("mark_paid")}>
              {mut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><Check className="mr-1 h-3.5 w-3.5" /> Mark paid</>)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpenNote((v) => !v)}>
              Reject
            </Button>
          </div>
        )}
      </div>

      {openNote && actionable && (
        <div className="border-t border-border/60 p-4">
          <div className="flex flex-col gap-2 md:flex-row">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reason (admin only)…"
              className="min-h-[60px] flex-1"
            />
            <div className="flex gap-2 md:flex-col">
              <Button size="sm" variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate("reject")}>
                Reject & refund
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenNote(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {!actionable && row.admin_note && (
        <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-semibold">Note:</span> {row.admin_note}
        </div>
      )}
    </div>
  );
}

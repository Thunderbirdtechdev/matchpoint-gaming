import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet, Copy, ExternalLink, RefreshCw, Banknote, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { adminCreditWallet, adminGrantRole, adminRevokeRole, adminListStaff } from "@/lib/admin.functions";
import { getHotWalletStatus } from "@/lib/crypto.functions";
import { adminListPayoutRequests, adminUpdatePayoutRequest } from "@/lib/payouts.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MatchPoint" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", user!.id)).data?.map((r) => r.role) ?? [],
  });
  const isAdmin = roles?.includes("admin");

  const { data: users } = useQuery({
    queryKey: ["all-profiles"],
    enabled: !!isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  if (roles && !isAdmin) {
    return <DashboardShell title="Admin"><p className="text-sm text-muted-foreground">You don't have admin access.</p></DashboardShell>;
  }

  return (
    <DashboardShell title="Admin Dashboard" subtitle="Manage users and platform health.">
      <HotWalletCard isAdmin={!!isAdmin} />
      <div className="h-6" />
      <PayoutsCard />
      <div className="h-6" />
      <RolesCard />
      <div className="h-6" />
      <AdminCreditWalletCard />


      <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-card">
        <table className="w-full text-sm">
          <thead className="bg-surface/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">XP</th>
              <th className="px-4 py-3 text-right">Reputation</th>
              <th className="px-4 py-3 text-right">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id} className="border-t border-border/40">
                <td className="px-4 py-3"><div className="font-medium">{u.display_name ?? u.username}</div><div className="text-xs text-muted-foreground">@{u.username}</div></td>
                <td className="px-4 py-3 text-muted-foreground">{u.rank_tier}</td>
                <td className="px-4 py-3 text-right">{u.xp}</td>
                <td className="px-4 py-3 text-right">{u.reputation}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}

function AdminCreditWalletCard() {
  const creditFn = useServerFn(adminCreditWallet);
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("PayPal sandbox test credit");

  const mut = useMutation({
    mutationFn: async () =>
      creditFn({
        data: {
          target: target.trim(),
          amount_cents: Math.round(Number(amount) * 100),
          note: note.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Credited. New balance: $${(Number(res.balance_cents) / 100).toFixed(2)}`);
    },
    onError: (e: Error) => toast.error(e.message || "Credit failed"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" /> Credit a test wallet
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Admin-only. Add sandbox balance to any user (by email or user id) to test PayPal payouts. Records an{" "}
        <code className="rounded bg-muted px-1">adjustment</code> ledger entry.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_2fr_auto]">
        <Input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="user email or uuid" />
        <Input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount USD"
        />
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
        <Button
          onClick={() => {
            const n = Number(amount);
            if (!target.trim()) return toast.error("Enter a user email or id");
            if (!n || n < 1) return toast.error("Enter a valid amount");
            mut.mutate();
          }}
          disabled={mut.isPending}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Credit wallet"}
        </Button>
      </div>
    </div>
  );
}

function HotWalletCard({ isAdmin }: { isAdmin: boolean }) {
  const statusFn = useServerFn(getHotWalletStatus);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["hot-wallet-status"],
    enabled: isAdmin,
    queryFn: () => statusFn({}),
    refetchInterval: 30_000,
  });

  if (!isAdmin) return null;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Address copied");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="h-4 w-4" /> Payout hot wallet — USDC on Base
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading on-chain balances…
        </div>
      ) : !data?.configured ? (
        <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-200">Hot wallet not configured.</p>
          <p className="mt-1 text-xs text-amber-100/80">
            Add the secret <code className="rounded bg-black/30 px-1">HOT_WALLET_EVM_PRIVATE_KEY</code> (an
            EVM private key) in project settings. Then send USDC on Base to the address shown here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
              <div className="text-xs uppercase text-muted-foreground">USDC balance</div>
              <div className="mt-1 text-2xl font-semibold">
                {data.usdc != null ? `$${data.usdc.toFixed(2)}` : "—"}
              </div>
              <div className="text-xs text-muted-foreground">Available for payouts</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
              <div className="text-xs uppercase text-muted-foreground">ETH (gas)</div>
              <div className="mt-1 text-2xl font-semibold">
                {data.eth != null ? data.eth.toFixed(5) : "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                Needed for every send. Keep ~0.001+ ETH.
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-surface/40 p-3">
              <div className="text-xs uppercase text-muted-foreground">Recent sends</div>
              <div className="mt-1 text-2xl font-semibold">{data.recentPayouts.length}</div>
              <div className="text-xs text-muted-foreground">Last 25 USDC payouts</div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border/60 bg-surface/40 p-3">
            <div className="text-xs uppercase text-muted-foreground">Wallet address (Base)</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="break-all rounded bg-black/30 px-2 py-1 text-xs">{data.address}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(data.address!)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <a
                href={data.explorerUrl!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                BaseScan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Send <strong>USDC on Base</strong> (contract{" "}
              <code>0x8335…2913</code>) to this address from any exchange or wallet. Funds appear here
              within ~30 seconds of confirmation.
            </p>
          </div>

          {data.error && (
            <p className="mt-3 text-xs text-destructive">RPC error: {data.error}</p>
          )}

          {data.recentPayouts.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-surface/50 uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">To</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPayouts.map((p) => (
                    <tr key={p.id} className="border-t border-border/40">
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <code>{p.to_address.slice(0, 6)}…{p.to_address.slice(-4)}</code>
                      </td>
                      <td className="px-3 py-2 text-right">${(p.amount_cents / 100).toFixed(2)}</td>
                      <td className="px-3 py-2">{p.status}</td>
                      <td className="px-3 py-2">
                        {p.tx_hash ? (
                          <a
                            className="text-primary hover:underline"
                            href={`https://basescan.org/tx/${p.tx_hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {p.tx_hash.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

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

function PayoutsCard() {
  const [speed, setSpeed] = useState<"same_day" | "standard">("same_day");
  const listFn = useServerFn(adminListPayoutRequests);
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-payouts", speed],
    queryFn: () => listFn({ data: { speed, limit: 100 } }) as Promise<PayoutRow[]>,
    refetchInterval: 30_000,
  });

  const pending = (data ?? []).filter((r) => r.status === "pending" || r.status === "processing");
  const history = (data ?? []).filter((r) => r.status !== "pending" && r.status !== "processing");

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Banknote className="h-4 w-4" /> Payout management
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Review and authorize manual payouts. Pay the user via PayPal or Cash App using the handle shown, then mark the request paid. Rejecting refunds the user's wallet.
      </p>

      <Tabs value={speed} onValueChange={(v) => setSpeed(v as "same_day" | "standard")} className="mt-4">
        <TabsList>
          <TabsTrigger value="same_day">Same-day (30 min – 5 hr)</TabsTrigger>
          <TabsTrigger value="standard">Standard (2–5 days)</TabsTrigger>
        </TabsList>

        <TabsContent value={speed} className="mt-4 space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payout requests…
            </div>
          ) : (
            <>
              <PayoutTable
                title={`Awaiting action (${pending.length})`}
                rows={pending}
                actionable
                onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })}
              />
              <PayoutTable
                title={`Recent history (${history.length})`}
                rows={history}
                actionable={false}
                onChanged={() => qc.invalidateQueries({ queryKey: ["admin-payouts"] })}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PayoutTable({
  title,
  rows,
  actionable,
  onChanged,
}: {
  title: string;
  rows: PayoutRow[];
  actionable: boolean;
  onChanged: () => void;
}) {
  if (!rows.length) {
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
        <div className="rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
          Nothing here.
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-surface/50 uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Requested</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Method</th>
              <th className="px-3 py-2 text-left">Send to</th>
              <th className="px-3 py-2 text-right">Gross</th>
              <th className="px-3 py-2 text-right">Fee</th>
              <th className="px-3 py-2 text-right">Net to pay</th>
              <th className="px-3 py-2 text-left">Status</th>
              {actionable && <th className="px-3 py-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <PayoutRowView key={r.id} row={r} actionable={actionable} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      </div>
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

function PayoutRowView({ row, actionable, onChanged }: { row: PayoutRow; actionable: boolean; onChanged: () => void }) {
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
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <>
      <tr className="border-t border-border/40 align-top">
        <td className="px-3 py-2 text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
        <td className="px-3 py-2">
          <div className="font-medium">{player}</div>
          {row.profiles?.username && <div className="text-[10px] text-muted-foreground">@{row.profiles.username}</div>}
        </td>
        <td className="px-3 py-2 uppercase">{row.method === "paypal" ? "PayPal" : "Cash App"}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={() => copy(row.handle)}
            className="inline-flex items-center gap-1 rounded bg-black/30 px-2 py-1 font-mono text-[11px] hover:bg-black/40"
            title="Click to copy"
          >
            {row.handle}
            <Copy className="h-3 w-3" />
          </button>
        </td>
        <td className="px-3 py-2 text-right">${(row.amount_cents / 100).toFixed(2)}</td>
        <td className="px-3 py-2 text-right text-muted-foreground">${(row.fee_cents / 100).toFixed(2)}</td>
        <td className="px-3 py-2 text-right font-semibold">${(row.net_cents / 100).toFixed(2)}</td>
        <td className="px-3 py-2">{statusBadge(row.status)}</td>
        {actionable && (
          <td className="px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {row.status === "pending" && (
                <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("mark_processing")}>
                  Mark processing
                </Button>
              )}
              <Button size="sm" disabled={mut.isPending} onClick={() => mut.mutate("mark_paid")}>
                {mut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark paid"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenNote((v) => !v)}>
                Reject…
              </Button>
            </div>
          </td>
        )}
      </tr>
      {openNote && actionable && (
        <tr className="border-t border-border/40 bg-surface/30">
          <td colSpan={9} className="px-3 py-3">
            <div className="flex flex-col gap-2 md:flex-row">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason (visible to admins only)…"
                className="min-h-[60px] flex-1"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate("reject")}>
                  Reject & refund
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpenNote(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
      {!actionable && row.admin_note && (
        <tr className="border-t border-border/40 bg-surface/20">
          <td colSpan={9} className="px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold">Note:</span> {row.admin_note}
          </td>
        </tr>
      )}
    </>
  );
}

type StaffRow = {
  user_id: string;
  role: "admin" | "moderator";
  created_at: string;
  profile: { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null } | null;
};

function RolesCard() {
  const listFn = useServerFn(adminListStaff);
  const grantFn = useServerFn(adminGrantRole);
  const revokeFn = useServerFn(adminRevokeRole);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: staff, isLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => listFn({}) as Promise<StaffRow[]>,
  });

  const [target, setTarget] = useState("");
  const [role, setRole] = useState<"admin" | "moderator">("moderator");

  const grant = useMutation({
    mutationFn: () => grantFn({ data: { target: target.trim(), role } }),
    onSuccess: () => {
      toast.success(`Granted ${role}.`);
      setTarget("");
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (e: Error) => toast.error(e.message || "Grant failed"),
  });

  const revoke = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "moderator" }) =>
      revokeFn({ data: { target: vars.userId, role: vars.role } }),
    onSuccess: () => {
      toast.success("Role revoked.");
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (e: Error) => toast.error(e.message || "Revoke failed"),
  });

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4" /> Admin &amp; moderator roles
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Grant admin or moderator privileges to any existing player account — the role attaches to their normal gameplay account, no separate login. They'll see the admin tools next time they sign in.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
        <Input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="username, email, or user id"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "moderator")}
          className="h-10 rounded-md border border-border/60 bg-background px-3 text-sm"
        >
          <option value="moderator">Moderator</option>
          <option value="admin">Admin</option>
        </select>
        <Button
          onClick={() => {
            if (!target.trim()) return toast.error("Enter a username, email, or id");
            grant.mutate();
          }}
          disabled={grant.isPending}
        >
          {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Grant role"}
        </Button>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
        <table className="w-full text-xs">
          <thead className="bg-surface/50 uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-left">Role</th>
              <th className="px-3 py-2 text-left">Granted</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Loading…</td></tr>
            ) : !staff?.length ? (
              <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">No staff yet.</td></tr>
            ) : (
              staff.map((s) => {
                const isSelf = s.user_id === user?.id;
                const name = s.profile?.display_name ?? s.profile?.username ?? s.user_id.slice(0, 8);
                return (
                  <tr key={`${s.user_id}-${s.role}`} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">{name} {isSelf && <span className="text-[10px] text-muted-foreground">(you)</span>}</div>
                      {s.profile?.username && <div className="text-[10px] text-muted-foreground">@{s.profile.username}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={s.role === "admin" ? "border-primary/40 text-primary" : "border-border"}>
                        {s.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revoke.isPending || (s.role === "admin" && isSelf)}
                        onClick={() => revoke.mutate({ userId: s.user_id, role: s.role })}
                      >
                        Revoke
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



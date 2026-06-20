import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminCreditWallet } from "@/lib/admin.functions";
import { getHotWalletStatus } from "@/lib/crypto.functions";

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

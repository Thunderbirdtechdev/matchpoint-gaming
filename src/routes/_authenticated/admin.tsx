import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { adminCreditWallet } from "@/lib/admin.functions";

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

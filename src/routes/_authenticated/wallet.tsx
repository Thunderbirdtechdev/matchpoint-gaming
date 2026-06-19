import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Wallet — MatchPoint" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  return (
    <DashboardShell title="Wallet" subtitle="Track winnings and balance.">
      <div className="max-w-md rounded-2xl border border-border/60 bg-gradient-brand p-8 text-primary-foreground">
        <Wallet className="h-7 w-7" />
        <div className="mt-6 text-sm opacity-80">Available balance</div>
        <div className="mt-1 text-4xl font-bold">${Number(profile?.wallet_balance ?? 0).toFixed(2)}</div>
        <p className="mt-6 text-xs opacity-70">Deposits, withdrawals, and transaction history are coming soon. Contact support for assistance with payouts.</p>
      </div>
    </DashboardShell>
  );
}

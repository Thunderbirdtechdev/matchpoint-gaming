import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Trophy, Swords, Wallet, TrendingUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MatchPoint" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: myChallenges } = useQuery({
    queryKey: ["my-challenges", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("challenges")
      .select("*").or(`creator_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
      .order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  const { data: openChallenges } = useQuery({
    queryKey: ["open-challenges"],
    queryFn: async () => (await supabase.from("challenges").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(5)).data ?? [],
  });

  const { data: upcoming } = useQuery({
    queryKey: ["upcoming-tournaments"],
    queryFn: async () => (await supabase.from("tournaments").select("*").eq("status", "upcoming").order("starts_at").limit(4)).data ?? [],
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("balance_cents").eq("user_id", user!.id).maybeSingle()).data,
  });

  const stats = [
    { label: "Reputation", value: profile?.reputation ?? 100, icon: TrendingUp },
    { label: "XP", value: profile?.xp ?? 0, icon: Trophy },
    { label: "Active matches", value: myChallenges?.filter((c) => c.status === "active").length ?? 0, icon: Swords },
    { label: "Wallet", value: `$${((wallet?.balance_cents ?? 0) / 100).toFixed(2)}`, icon: Wallet },
  ];

  return (
    <DashboardShell title={`Welcome, ${profile?.display_name ?? "Player"}`} subtitle={`Rank: ${profile?.rank_tier ?? "Bronze"}`}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-gradient-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">{s.label}</span>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your recent matches</h2>
            <Button asChild size="sm" variant="ghost"><Link to="/challenges">View all</Link></Button>
          </div>
          <div className="mt-4 space-y-2">
            {myChallenges?.length ? myChallenges.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{c.game_slug} · {c.platform}</div>
                  <div className="text-xs text-muted-foreground">${Number(c.entry_amount).toFixed(2)} pool</div>
                </div>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">{c.status}</span>
              </div>
            )) : <p className="text-sm text-muted-foreground">No matches yet. Create a challenge to get started.</p>}
            <Button asChild className="mt-3 w-full bg-gradient-brand text-primary-foreground"><Link to="/challenges"><Plus className="mr-2 h-4 w-4" />New challenge</Link></Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6">
          <h2 className="font-semibold">Open challenges</h2>
          <div className="mt-4 space-y-2">
            {openChallenges?.length ? openChallenges.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 text-sm">
                <div>
                  <div className="font-medium capitalize">{c.game_slug} · {c.platform}</div>
                  <div className="text-xs text-muted-foreground">{c.rules?.slice(0, 60) ?? "Standard rules"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-accent">${Number(c.entry_amount).toFixed(2)}</div>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No open challenges right now.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Upcoming tournaments</h2>
            <Button asChild size="sm" variant="ghost"><Link to="/my-tournaments">My tournaments</Link></Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {upcoming?.length ? upcoming.map((t) => (
              <div key={t.id} className="rounded-xl border border-border/50 bg-surface/50 p-4">
                <div className="text-sm font-semibold">{t.title}</div>
                <div className="mt-1 text-xs text-muted-foreground capitalize">{t.game_slug} · {t.platform}</div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{new Date(t.starts_at).toLocaleDateString()}</span>
                  <span className="font-bold text-accent">${Number(t.prize_pool).toFixed(0)} pool</span>
                </div>
              </div>
            )) : <p className="text-sm text-muted-foreground">No upcoming tournaments. Host one!</p>}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

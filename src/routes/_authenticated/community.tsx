import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({ meta: [{ title: "Community — MatchPoint" }] }),
  component: CommunityPage,
});

function CommunityPage() {
  const { data: players } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("xp", { ascending: false }).limit(50)).data ?? [],
  });

  return (
    <DashboardShell title="Community" subtitle="Top players this season.">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-card">
        <table className="w-full text-sm">
          <thead className="bg-surface/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">XP</th>
              <th className="px-4 py-3 text-right">Reputation</th>
            </tr>
          </thead>
          <tbody>
            {players?.map((p, i) => (
              <tr key={p.id} className="border-t border-border/40">
                <td className="px-4 py-3 font-bold">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.display_name ?? p.username ?? "Player"}</div>
                  <div className="text-xs text-muted-foreground">@{p.username ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.rank_tier}</td>
                <td className="px-4 py-3 text-right font-semibold">{p.xp}</td>
                <td className="px-4 py-3 text-right">{p.reputation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}

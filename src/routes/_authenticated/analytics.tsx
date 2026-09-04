import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/dashboard/RequireCapability";
import { useRoles } from "@/hooks/use-roles";
import { Users, Swords, Trophy, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics | MatchPoint" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { can } = useRoles();

  const { data: counts } = useQuery({
    queryKey: ["analytics-counts"],
    enabled: can("platform.analytics"),
    queryFn: async () => {
      const [u, c, t, d] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("challenges").select("*", { count: "exact", head: true }),
        supabase.from("tournaments").select("*", { count: "exact", head: true }),
        supabase.from("disputes").select("*", { count: "exact", head: true }),
      ]);
      return { users: u.count ?? 0, challenges: c.count ?? 0, tournaments: t.count ?? 0, disputes: d.count ?? 0 };
    },
  });

  const stats = [
    { label: "Players", value: counts?.users ?? 0, icon: Users },
    { label: "Challenges", value: counts?.challenges ?? 0, icon: Swords },
    { label: "Tournaments", value: counts?.tournaments ?? 0, icon: Trophy },
    { label: "Disputes", value: counts?.disputes ?? 0, icon: ShieldAlert },
  ];

  return (
    <RequireCapability
      capability="platform.analytics"
      title="Analytics"
      subtitle="Platform health at a glance."
    >
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-gradient-card p-5">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs uppercase">{s.label}</span><s.icon className="h-4 w-4" /></div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
    </RequireCapability>
  );
}

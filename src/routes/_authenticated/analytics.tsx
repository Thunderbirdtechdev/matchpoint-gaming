import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Users, Swords, Trophy, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — MatchPoint" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { user } = useAuth();
  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", user!.id)).data?.map((r) => r.role) ?? [],
  });
  const isAdmin = roles?.includes("admin");

  const { data: counts } = useQuery({
    queryKey: ["analytics-counts"],
    enabled: !!isAdmin,
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

  if (roles && !isAdmin) {
    return <DashboardShell title="Analytics"><p className="text-sm text-muted-foreground">Admins only.</p></DashboardShell>;
  }

  const stats = [
    { label: "Players", value: counts?.users ?? 0, icon: Users },
    { label: "Challenges", value: counts?.challenges ?? 0, icon: Swords },
    { label: "Tournaments", value: counts?.tournaments ?? 0, icon: Trophy },
    { label: "Disputes", value: counts?.disputes ?? 0, icon: ShieldAlert },
  ];

  return (
    <DashboardShell title="Analytics" subtitle="Platform health at a glance.">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-gradient-card p-5">
            <div className="flex items-center justify-between text-muted-foreground"><span className="text-xs uppercase">{s.label}</span><s.icon className="h-4 w-4" /></div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}

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
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-card">
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

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/moderator")({
  head: () => ({ meta: [{ title: "Moderator — MatchPoint" }] }),
  component: ModeratorPage,
});

function ModeratorPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: roles } = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", user!.id)).data?.map((r) => r.role) ?? [],
  });

  const isStaff = roles?.includes("moderator") || roles?.includes("admin");

  const { data: disputes } = useQuery({
    queryKey: ["all-disputes"],
    enabled: !!isStaff,
    queryFn: async () => (await supabase.from("disputes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function resolve(id: string, resolution: string) {
    const { error } = await supabase.from("disputes").update({ status: "resolved", resolution }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Resolved");
    qc.invalidateQueries({ queryKey: ["all-disputes"] });
  }

  if (roles && !isStaff) {
    return <DashboardShell title="Moderator"><p className="text-sm text-muted-foreground">You don't have moderator access.</p></DashboardShell>;
  }

  return (
    <DashboardShell title="Moderator Dashboard" subtitle="Review and resolve disputes.">
      <div className="grid gap-3">
        {disputes?.length ? disputes.map((d) => (
          <div key={d.id} className="rounded-xl border border-border/60 bg-gradient-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium">{d.reason}</div>
                <div className="mt-1 text-xs text-muted-foreground">Opened by {d.opened_by.slice(0, 8)} · {new Date(d.created_at).toLocaleString()}</div>
                {d.evidence_url && <a href={d.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Evidence</a>}
              </div>
              {d.status === "open" ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(d.id, "Dispute denied")}>Deny</Button>
                  <Button size="sm" onClick={() => resolve(d.id, "Dispute upheld")} className="bg-gradient-brand text-primary-foreground">Uphold</Button>
                </div>
              ) : (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs capitalize text-primary">{d.status}</span>
              )}
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No disputes to review.</p>}
      </div>
    </DashboardShell>
  );
}

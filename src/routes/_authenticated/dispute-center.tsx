import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dispute-center")({
  head: () => ({ meta: [{ title: "Dispute Center — MatchPoint" }] }),
  component: DisputePage,
});

function DisputePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ challenge_id: "", reason: "", evidence_url: "" });

  const { data: disputes } = useQuery({
    queryKey: ["my-disputes", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("disputes").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function submit() {
    if (!user) return;
    const { error } = await supabase.from("disputes").insert({
      opened_by: user.id,
      challenge_id: form.challenge_id || null,
      reason: form.reason,
      evidence_url: form.evidence_url || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Dispute submitted. Moderators will review.");
    setOpen(false);
    setForm({ challenge_id: "", reason: "", evidence_url: "" });
    qc.invalidateQueries({ queryKey: ["my-disputes"] });
  }

  return (
    <DashboardShell title="Dispute Center" subtitle="Report match issues and track resolutions.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6 bg-gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Open dispute</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Open a dispute</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Challenge ID (optional)</Label><Input value={form.challenge_id} onChange={(e) => setForm({ ...form, challenge_id: e.target.value })} /></div>
            <div className="space-y-2"><Label>Reason</Label><Textarea rows={4} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Evidence URL (screenshot/video)</Label><Input value={form.evidence_url} onChange={(e) => setForm({ ...form, evidence_url: e.target.value })} placeholder="https://..." /></div>
            <Button onClick={submit} className="w-full bg-gradient-brand text-primary-foreground">Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {disputes?.length ? disputes.map((d) => (
          <div key={d.id} className="rounded-xl border border-border/60 bg-gradient-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 text-accent" />
                <div>
                  <div className="text-sm font-medium">{d.reason}</div>
                  {d.evidence_url && <a href={d.evidence_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View evidence</a>}
                </div>
              </div>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">{d.status}</span>
            </div>
            {d.resolution && <p className="mt-2 text-xs text-muted-foreground">Resolution: {d.resolution}</p>}
          </div>
        )) : <p className="text-sm text-muted-foreground">No disputes yet.</p>}
      </div>
    </DashboardShell>
  );
}

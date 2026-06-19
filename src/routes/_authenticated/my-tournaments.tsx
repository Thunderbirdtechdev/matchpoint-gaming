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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-tournaments")({
  head: () => ({ meta: [{ title: "Tournaments — MatchPoint" }] }),
  component: MyTournamentsPage,
});

const GAMES = ["fortnite", "madden", "nba2k", "mlb", "cod", "fc"];

function MyTournamentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", game_slug: "fortnite", platform: "PC",
    max_players: "16", entry_fee: "0", prize_pool: "0", starts_at: "",
  });

  const { data: tournaments } = useQuery({
    queryKey: ["all-tournaments"],
    queryFn: async () => (await supabase.from("tournaments").select("*").order("starts_at").limit(50)).data ?? [],
  });

  const { data: myEntries } = useQuery({
    queryKey: ["my-entries", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("tournament_entries").select("tournament_id").eq("user_id", user!.id)).data ?? [],
  });

  const joinedIds = new Set(myEntries?.map((e) => e.tournament_id));

  async function createTournament() {
    if (!user) return;
    if (!form.title || !form.starts_at) return toast.error("Title and start date are required");
    const { error } = await supabase.from("tournaments").insert({
      host_id: user.id,
      title: form.title,
      description: form.description,
      game_slug: form.game_slug,
      platform: form.platform,
      max_players: Number(form.max_players),
      entry_fee: Number(form.entry_fee),
      prize_pool: Number(form.prize_pool),
      starts_at: new Date(form.starts_at).toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Tournament created");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["all-tournaments"] });
  }

  async function joinTournament(id: string) {
    if (!user) return;
    const { error } = await supabase.from("tournament_entries").insert({ tournament_id: id, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Joined!");
    qc.invalidateQueries({ queryKey: ["my-entries"] });
  }

  return (
    <DashboardShell title="Tournaments" subtitle="Join brackets or host your own.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6 bg-gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Host tournament</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New tournament</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Game</Label>
                <Select value={form.game_slug} onValueChange={(v) => setForm({ ...form, game_slug: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GAMES.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
              <div className="space-y-2"><Label>Max players</Label><Input type="number" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value })} /></div>
              <div className="space-y-2"><Label>Entry fee ($)</Label><Input type="number" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prize pool ($)</Label><Input type="number" value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} /></div>
              <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            </div>
            <Button onClick={createTournament} className="w-full bg-gradient-brand text-primary-foreground">Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2">
        {tournaments?.length ? tournaments.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 bg-gradient-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-accent" /><span className="text-xs uppercase text-muted-foreground capitalize">{t.game_slug}</span></div>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">{t.status}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{t.description}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div><div className="text-muted-foreground">Prize</div><div className="font-bold text-accent">${Number(t.prize_pool).toFixed(0)}</div></div>
              <div><div className="text-muted-foreground">Entry</div><div className="font-bold">${Number(t.entry_fee).toFixed(0)}</div></div>
              <div><div className="text-muted-foreground">Players</div><div className="font-bold">{t.max_players}</div></div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{new Date(t.starts_at).toLocaleString()}</span>
              {joinedIds.has(t.id) ? (
                <span className="text-xs font-medium text-accent">Joined</span>
              ) : (
                <Button size="sm" onClick={() => joinTournament(t.id)} className="bg-gradient-brand text-primary-foreground">Join</Button>
              )}
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No tournaments yet.</p>}
      </div>
    </DashboardShell>
  );
}

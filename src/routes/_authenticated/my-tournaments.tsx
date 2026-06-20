import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { joinTournament as joinFn, declareTournamentWinner, cancelTournament } from "@/lib/matches.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { calculateTournamentFee } from "@/lib/fees";

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

  const joinSF = useServerFn(joinFn);
  const declareSF = useServerFn(declareTournamentWinner);
  const cancelSF = useServerFn(cancelTournament);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["all-tournaments"] });
    qc.invalidateQueries({ queryKey: ["my-entries"] });
    qc.invalidateQueries({ queryKey: ["my-wallet"] });
  }

  async function joinTournament(id: string) {
    try {
      await joinSF({ data: { tournament_id: id } });
      toast.success("Joined — entry held in escrow");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function declareWinner(tournamentId: string) {
    const winnerId = prompt("Enter winner's user ID:");
    if (!winnerId) return;
    try {
      const r = await declareSF({ data: { tournament_id: tournamentId, winner_id: winnerId } });
      toast.success(`Winner paid $${(r.net_cents/100).toFixed(2)} (pool $${(r.pool_cents/100).toFixed(2)} − $${(r.fee_cents/100).toFixed(2)} fee)`);
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel tournament and refund all entries?")) return;
    try {
      const r = await cancelSF({ data: { tournament_id: id } });
      toast.success(`Cancelled — refunded ${r.refunded} player(s)`);
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
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
            {(() => {
              const fee = calculateTournamentFee(Number(form.entry_fee), Number(form.max_players));
              return (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="font-medium text-foreground">Fee preview ({fee.tierLabel} tier · {(fee.rate * 100).toFixed(0)}%)</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                    <div>Max pool<div className="font-semibold text-foreground">${fee.pool.toFixed(2)}</div></div>
                    <div>Platform fee<div className="font-semibold text-foreground">${fee.serviceFee.toFixed(2)}</div></div>
                    <div>Winner takes<div className="font-semibold text-accent">${fee.netPrize.toFixed(2)}</div></div>
                  </div>
                </div>
              );
            })()}
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
            {(() => {
              const fee = calculateTournamentFee(Number(t.entry_fee), Number(t.max_players));
              return (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    <div><div className="text-muted-foreground">Winner takes</div><div className="font-bold text-accent">${fee.netPrize.toFixed(0)}</div></div>
                    <div><div className="text-muted-foreground">Entry</div><div className="font-bold">${Number(t.entry_fee).toFixed(0)}</div></div>
                    <div><div className="text-muted-foreground">Players</div><div className="font-bold">{t.max_players}</div></div>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">Pool ${fee.pool.toFixed(0)} · {(fee.rate * 100).toFixed(0)}% fee (${fee.serviceFee.toFixed(2)})</div>
                </>
              );
            })()}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{new Date(t.starts_at).toLocaleString()}</span>
              <div className="flex gap-2">
                {t.host_id === user?.id && t.status !== "completed" && t.status !== "cancelled" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => declareWinner(t.id)}><Crown className="mr-1 h-3 w-3" />Declare winner</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(t.id)}><X className="mr-1 h-3 w-3" />Cancel</Button>
                  </>
                )}
                {joinedIds.has(t.id) ? (
                  <span className="text-xs font-medium text-accent">Joined</span>
                ) : (
                  t.status !== "completed" && t.status !== "cancelled" && t.host_id !== user?.id && (
                    <Button size="sm" onClick={() => joinTournament(t.id)} className="bg-gradient-brand text-primary-foreground">Join</Button>
                  )
                )}
              </div>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No tournaments yet.</p>}
      </div>
    </DashboardShell>
  );
}

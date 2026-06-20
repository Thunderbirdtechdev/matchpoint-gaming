import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createChallenge as createChallengeFn, acceptChallenge as acceptChallengeFn, concedeChallenge, cancelChallenge } from "@/lib/matches.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Swords, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { calculateChallengeFee } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges — MatchPoint" }] }),
  component: ChallengesPage,
});

const GAMES = ["fortnite", "madden", "nba2k", "mlb", "cod", "fc"];
const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch"];

function ChallengesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ game_slug: "fortnite", platform: "PC", entry_amount: "10", rules: "" });

  const { data: challenges } = useQuery({
    queryKey: ["challenges-all"],
    queryFn: async () => (await supabase.from("challenges").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  async function createChallenge() {
    if (!user) return;
    const { error } = await supabase.from("challenges").insert({
      creator_id: user.id,
      game_slug: form.game_slug,
      platform: form.platform,
      entry_amount: Number(form.entry_amount),
      rules: form.rules,
      status: "open",
    });
    if (error) return toast.error(error.message);
    toast.success("Challenge posted");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["challenges-all"] });
    qc.invalidateQueries({ queryKey: ["my-challenges"] });
    qc.invalidateQueries({ queryKey: ["open-challenges"] });
  }

  async function acceptChallenge(id: string) {
    if (!user) return;
    const { error } = await supabase.from("challenges").update({ opponent_id: user.id, status: "active" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Challenge accepted! Good luck.");
    qc.invalidateQueries({ queryKey: ["challenges-all"] });
  }

  return (
    <DashboardShell title="Challenges" subtitle="Create a match or accept an open challenge.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6 bg-gradient-brand text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Create challenge</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New challenge</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Game</Label>
                <Select value={form.game_slug} onValueChange={(v) => setForm({ ...form, game_slug: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{GAMES.map((g) => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entry amount (USD)</Label>
              <Input type="number" min="0" step="1" value={form.entry_amount} onChange={(e) => setForm({ ...form, entry_amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rules</Label>
              <Textarea rows={3} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="Best of 3, no items..." />
            </div>
            {(() => {
              const fee = calculateChallengeFee(Number(form.entry_amount));
              return (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="font-medium text-foreground">Fee preview ({fee.tierLabel} tier · {(fee.rate * 100).toFixed(0)}%)</div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                    <div>Pool<div className="font-semibold text-foreground">${fee.pool.toFixed(2)}</div></div>
                    <div>Platform fee<div className="font-semibold text-foreground">${fee.serviceFee.toFixed(2)}</div></div>
                    <div>Winner takes<div className="font-semibold text-accent">${fee.netPrize.toFixed(2)}</div></div>
                  </div>
                </div>
              );
            })()}
            <Button onClick={createChallenge} className="w-full bg-gradient-brand text-primary-foreground">Post challenge</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {challenges?.length ? challenges.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-gradient-card p-4">
            <div className="flex items-center gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary"><Swords className="h-5 w-5" /></div>
              <div>
                <div className="font-medium capitalize">{c.game_slug} · {c.platform}</div>
                <div className="text-xs text-muted-foreground">{c.rules ?? "Standard rules"}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {(() => {
                const fee = calculateChallengeFee(Number(c.entry_amount));
                return (
                  <div className="text-right">
                    <div className="text-lg font-bold text-accent">${fee.netPrize.toFixed(2)}</div>
                    <div className="text-[11px] text-muted-foreground">Entry ${Number(c.entry_amount).toFixed(0)} · {(fee.rate * 100).toFixed(0)}% fee</div>
                    <div className="text-xs capitalize text-muted-foreground">{c.status}</div>
                  </div>
                );
              })()}
              {c.status === "open" && c.creator_id !== user?.id && (
                <Button size="sm" onClick={() => acceptChallenge(c.id)} className="bg-gradient-brand text-primary-foreground">Accept</Button>
              )}
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">No challenges yet. Be the first.</p>}
      </div>
    </DashboardShell>
  );
}

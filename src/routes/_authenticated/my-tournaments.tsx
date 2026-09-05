import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { joinTournament as joinFn, declareTournamentWinner, cancelTournament, createTournament as createTournamentFn } from "@/lib/matches.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trophy, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { calculateTournamentFee, SUPPORTED_GAMES, GAME_LABELS, MIN_ENTRY_USD } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/my-tournaments")({
  head: () => ({ meta: [{ title: "Tournaments | MatchPoint" }] }),
  component: MyTournamentsPage,
});

const GAMES = [...SUPPORTED_GAMES];

function MyTournamentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", game_slug: "fortnite", platform: "PC",
    max_players: "16", entry_fee: "0", prize_pool: "0", starts_at: "",
  });
  const [payoutType, setPayoutType] = useState<"winner_take_all" | "fixed" | "percentage">("winner_take_all");
  const [payoutPlaces, setPayoutPlaces] = useState<{ place: number; value: string }[]>([
    { place: 1, value: "100" },
  ]);

  const [declareFor, setDeclareFor] = useState<any>(null);
  const [declarePicks, setDeclarePicks] = useState<Record<number, string>>({});

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

  const createTournamentSF = useServerFn(createTournamentFn);

  function addPayoutPlace() {
    const nextPlace = payoutPlaces.length ? Math.max(...payoutPlaces.map((p) => p.place)) + 1 : 1;
    setPayoutPlaces([...payoutPlaces, { place: nextPlace, value: "" }]);
  }
  function removePayoutPlace(place: number) {
    setPayoutPlaces(payoutPlaces.filter((p) => p.place !== place));
  }

  async function createTournament() {
    if (!user) return;
    if (!form.title || !form.starts_at) return toast.error("Title and start date are required");
    const payout_structure =
      payoutType === "percentage"
        ? payoutPlaces.map((p) => ({ place: p.place, percent: Number(p.value) || 0 }))
        : payoutType === "fixed"
          ? payoutPlaces.map((p) => ({ place: p.place, amount_cents: Math.round((Number(p.value) || 0) * 100) }))
          : [];
    try {
      await createTournamentSF({
        data: {
          title: form.title,
          description: form.description,
          game_slug: form.game_slug,
          platform: form.platform,
          max_players: Number(form.max_players),
          entry_fee: Number(form.entry_fee),
          prize_pool: Number(form.prize_pool),
          starts_at: new Date(form.starts_at).toISOString(),
          payout_type: payoutType,
          payout_structure,
        },
      });
    } catch (e: any) {
      return toast.error(e?.message ?? "Failed to create tournament");
    }
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
      toast.success("Joined, entry held in escrow");
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  const { data: declareEntries } = useQuery({
    queryKey: ["tournament-entries", declareFor?.id],
    enabled: !!declareFor,
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("tournament_entries").select("user_id").eq("tournament_id", declareFor.id);
      const ids = (entries ?? []).map((e) => e.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles").select("id, username, display_name").in("id", ids);
      return ids.map((id) => profs?.find((p) => p.id === id) ?? { id, username: id.slice(0, 8), display_name: null });
    },
  });

  function openDeclareDialog(t: any) {
    setDeclareFor(t);
    setDeclarePicks({});
  }

  const declarePlaces: number[] =
    declareFor?.payout_type && declareFor.payout_type !== "winner_take_all" && declareFor.payout_structure?.length
      ? declareFor.payout_structure.map((p: { place: number }) => p.place).sort((a: number, b: number) => a - b)
      : [1];

  async function submitDeclareWinners() {
    if (!declareFor) return;
    const winners = declarePlaces
      .filter((place) => declarePicks[place])
      .map((place) => ({ place, user_id: declarePicks[place] }));
    if (!winners.length) return toast.error("Pick at least one winner");
    if (winners.length !== declarePlaces.length) return toast.error("Assign a player to every place");
    try {
      const r = await declareSF({ data: { tournament_id: declareFor.id, winners } });
      const total = r.payouts.reduce((s, p) => s + p.amount_cents, 0);
      toast.success(`Paid out $${(total / 100).toFixed(2)} (pool $${(r.pool_cents / 100).toFixed(2)} − $${(r.fee_cents / 100).toFixed(2)} fee)`);
      setDeclareFor(null);
      invalidateAll();
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel tournament and refund all entries?")) return;
    try {
      const r = await cancelSF({ data: { tournament_id: id } });
      toast.success(`Cancelled, refunded ${r.refunded} player(s)`);
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
                  <SelectContent>{GAMES.map((g) => <SelectItem key={g} value={g}>{GAME_LABELS[g as keyof typeof GAME_LABELS] ?? g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} /></div>
              <div className="space-y-2"><Label>Max players</Label><Input type="number" value={form.max_players} onChange={(e) => setForm({ ...form, max_players: e.target.value })} /></div>
              <div className="space-y-2"><Label>Entry fee (USD, min ${MIN_ENTRY_USD})</Label><Input type="number" min={MIN_ENTRY_USD} value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prize pool ($)</Label><Input type="number" value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} /></div>
              <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            </div>

            <div className="space-y-2">
              <Label>Payout structure</Label>
              <Select value={payoutType} onValueChange={(v) => {
                const nextType = v as "winner_take_all" | "fixed" | "percentage";
                setPayoutType(nextType);
                if (nextType === "winner_take_all") setPayoutPlaces([{ place: 1, value: "100" }]);
                else if (payoutPlaces.length <= 1) setPayoutPlaces([{ place: 1, value: "" }]);
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="winner_take_all">Winner takes all</SelectItem>
                  <SelectItem value="percentage">Percentage split</SelectItem>
                  <SelectItem value="fixed">Fixed amounts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payoutType !== "winner_take_all" && (
              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                {payoutPlaces.map((p, i) => (
                  <div key={p.place} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs text-muted-foreground">Place {p.place}</span>
                    <Input
                      type="number"
                      placeholder={payoutType === "percentage" ? "%" : "$"}
                      value={p.value}
                      onChange={(e) => {
                        const next = [...payoutPlaces];
                        next[i] = { ...next[i], value: e.target.value };
                        setPayoutPlaces(next);
                      }}
                    />
                    {payoutPlaces.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removePayoutPlace(p.place)}><X className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                ))}
                <Button size="sm" variant="outline" onClick={addPayoutPlace}><Plus className="mr-1 h-3 w-3" />Add place</Button>
                {payoutType === "percentage" && (
                  <p className="text-[11px] text-muted-foreground">
                    Total: {payoutPlaces.reduce((s, p) => s + (Number(p.value) || 0), 0)}% (must equal 100%)
                  </p>
                )}
              </div>
            )}

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
                    <Button size="sm" variant="outline" onClick={() => openDeclareDialog(t)}><Crown className="mr-1 h-3 w-3" />Declare winner</Button>
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

      <Dialog open={!!declareFor} onOpenChange={(o) => { if (!o) setDeclareFor(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Declare winner{declarePlaces.length > 1 ? "s" : ""}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {declarePlaces.map((place) => {
              const entry = declareFor?.payout_structure?.find((s: { place: number }) => s.place === place);
              const label =
                declareFor?.payout_type === "percentage" && entry?.percent != null
                  ? `Place ${place} (${entry.percent}%)`
                  : declareFor?.payout_type === "fixed" && entry?.amount_cents != null
                    ? `Place ${place} ($${(entry.amount_cents / 100).toFixed(2)})`
                    : "Winner";
              const takenElsewhere = new Set(Object.entries(declarePicks).filter(([p]) => Number(p) !== place).map(([, v]) => v));
              return (
                <div key={place} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Select
                    value={declarePicks[place] ?? ""}
                    onValueChange={(v) => setDeclarePicks({ ...declarePicks, [place]: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a player" /></SelectTrigger>
                    <SelectContent>
                      {(declareEntries ?? [])
                        .filter((p: any) => !takenElsewhere.has(p.id))
                        .map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.display_name ?? p.username ?? p.id.slice(0, 8)}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            <Button onClick={submitDeclareWinners} className="w-full bg-gradient-brand text-primary-foreground">
              Confirm & pay out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

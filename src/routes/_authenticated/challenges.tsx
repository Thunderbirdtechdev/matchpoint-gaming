import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import {
  createChallenge as createChallengeFn,
  acceptChallenge as acceptChallengeFn,
  concedeChallenge,
  cancelChallenge,
  reportChallengeResult,
} from "@/lib/matches.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Swords, Flag, X, Trophy } from "lucide-react";
import { toast } from "sonner";
import { calculateChallengeFee, SUPPORTED_GAMES, GAME_LABELS, MIN_ENTRY_USD } from "@/lib/fees";

export const Route = createFileRoute("/_authenticated/challenges")({
  head: () => ({ meta: [{ title: "Challenges — MatchPoint" }] }),
  component: ChallengesPage,
});

const GAMES = [...SUPPORTED_GAMES];
const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch"];

function ChallengesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    game_slug: "fortnite",
    platform: "PC",
    entry_amount: "10",
    rules: "",
    /** "" = open to the marketplace; anything else = private to that player. */
    invite: "",
  });
  const [inviteMode, setInviteMode] = useState<"open" | "invite">("open");
  const createFn = useServerFn(createChallengeFn);
  const acceptFn = useServerFn(acceptChallengeFn);
  const concedeFn = useServerFn(concedeChallenge);
  const cancelFn = useServerFn(cancelChallenge);
  const reportResultFn = useServerFn(reportChallengeResult);
  const [reportFor, setReportFor] = useState<any>(null);

  const { data: challenges } = useQuery({
    queryKey: ["challenges-all"],
    queryFn: async () =>
      (
        await supabase
          .from("challenges")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  /*
   * Challenges someone has sent to ME specifically.
   *
   * Separate from the main list because an invitation is a different thing
   * from a listing: it is addressed, it expires the creator's money into
   * escrow while it waits, and it is the one item on this page that needs a
   * decision. Burying it in a list of fifty open challenges would waste the
   * whole feature.
   */
  const { data: invites } = useQuery({
    queryKey: ["my-invites", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("challenges")
          .select("*")
          .eq("invited_user_id", user!.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["my-invites"] });
    qc.invalidateQueries({ queryKey: ["challenges-all"] });
    qc.invalidateQueries({ queryKey: ["my-challenges"] });
    qc.invalidateQueries({ queryKey: ["open-challenges"] });
    qc.invalidateQueries({ queryKey: ["my-wallet"] });
  }

  async function createChallenge() {
    if (!user) return;
    try {
      const invite = inviteMode === "invite" ? form.invite.trim() : "";
      if (inviteMode === "invite" && !invite) {
        toast.error("Enter the username or email of the player you want to challenge.");
        return;
      }
      await createFn({
        data: {
          game_slug: form.game_slug,
          platform: form.platform,
          entry_amount: Number(form.entry_amount),
          rules: form.rules,
          ...(invite ? { invite } : {}),
        },
      });
      toast.success(
        invite
          ? `Challenge sent to ${invite} — stake held in escrow. Only they can accept it.`
          : "Challenge posted — stake held in escrow",
      );
      setOpen(false);
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function acceptChallenge(id: string) {
    try {
      await acceptFn({ data: { challenge_id: id } });
      toast.success("Challenge accepted — your stake is in escrow. GL!");
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function concede(id: string) {
    if (!confirm("Concede this match? Your opponent will be paid the prize.")) return;
    try {
      const r = await concedeFn({ data: { challenge_id: id } });
      toast.success(`Conceded. $${(r.net_cents / 100).toFixed(2)} paid to opponent.`);
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function cancel(id: string) {
    try {
      await cancelFn({ data: { challenge_id: id } });
      toast.success("Cancelled — stake refunded");
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function reportResult(reportedWinnerId: string) {
    if (!reportFor) return;
    try {
      const r = await reportResultFn({
        data: { challenge_id: reportFor.id, reported_winner_id: reportedWinnerId },
      });
      if (r.status === "waiting") {
        toast.success("Result recorded — waiting for your opponent to confirm.");
      } else if (r.status === "settled") {
        toast.success(`Match settled — $${(r.net_cents / 100).toFixed(2)} paid out.`);
      } else if (r.status === "disputed") {
        toast.warning(
          "You and your opponent reported different winners. Funds are locked — our fair play team will review.",
        );
      }
      setReportFor(null);
      invalidateAll();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <DashboardShell title="Challenges" subtitle="Create a match or accept an open challenge.">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mb-6 bg-gradient-brand text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" />
            Create challenge
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New challenge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Game</Label>
                <Select
                  value={form.game_slug}
                  onValueChange={(v) => setForm({ ...form, game_slug: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAMES.map((g) => (
                      <SelectItem key={g} value={g}>
                        {GAME_LABELS[g as keyof typeof GAME_LABELS] ?? g}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Entry amount (USD, min ${MIN_ENTRY_USD})</Label>
              <Input
                type="number"
                min={MIN_ENTRY_USD}
                step="1"
                value={form.entry_amount}
                onChange={(e) => setForm({ ...form, entry_amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rules</Label>
              <Textarea
                rows={3}
                value={form.rules}
                onChange={(e) => setForm({ ...form, rules: e.target.value })}
                placeholder="Best of 3, no items..."
              />
            </div>
            {/*
              Who can accept. Two mutually exclusive choices rather than a
              checkbox, because "invite someone" and "post publicly" are
              different products from the player's side, and the consequence
              (does anyone else see this?) should be readable at a glance.
            */}
            <div className="space-y-2">
              <Label>Who can accept</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["open", "Anyone", "Posted to the marketplace"],
                    ["invite", "A specific player", "Private invite"],
                  ] as const
                ).map(([mode, label, hint]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setInviteMode(mode)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      inviteMode === mode
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
                  </button>
                ))}
              </div>

              {inviteMode === "invite" && (
                <div className="space-y-2 pt-1">
                  <Input
                    value={form.invite}
                    onChange={(e) => setForm({ ...form, invite: e.target.value })}
                    placeholder="username or email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Only they can accept, and it won't appear in the marketplace. Your stake is held
                    in escrow while you wait — cancel any time to get it back.
                  </p>
                </div>
              )}
            </div>

            {(() => {
              const fee = calculateChallengeFee(Number(form.entry_amount));
              return (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="font-medium text-foreground">
                    Fee preview ({fee.tierLabel} tier · {(fee.rate * 100).toFixed(0)}%)
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-muted-foreground">
                    <div>
                      Pool
                      <div className="font-semibold text-foreground">${fee.pool.toFixed(2)}</div>
                    </div>
                    <div>
                      Platform fee
                      <div className="font-semibold text-foreground">
                        ${fee.serviceFee.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      Winner takes
                      <div className="font-semibold text-accent">${fee.netPrize.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })()}
            <Button
              onClick={createChallenge}
              className="w-full bg-gradient-brand text-primary-foreground"
            >
              {inviteMode === "invite" ? "Send challenge" : "Post challenge"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {invites && invites.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Swords className="h-4 w-4" /> Challenges sent to you
          </h2>
          <div className="mt-3 grid gap-3">
            {invites.map((c) => {
              const fee = calculateChallengeFee(Number(c.entry_amount));
              return (
                <div
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {c.game_slug} · {c.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.rules || "Standard rules"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-lg font-bold text-accent">
                        ${fee.netPrize.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Entry ${Number(c.entry_amount).toFixed(0)}
                      </div>
                    </div>
                    <Button
                      onClick={() => acceptChallenge(c.id)}
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-3">
        {challenges?.length ? (
          challenges.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-gradient-card p-4"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Swords className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium capitalize">
                    {c.game_slug} · {c.platform}
                  </div>
                  <div className="text-xs text-muted-foreground">{c.rules ?? "Standard rules"}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {(() => {
                  const fee = calculateChallengeFee(Number(c.entry_amount));
                  return (
                    <div className="text-right">
                      <div className="text-lg font-bold text-accent">
                        ${fee.netPrize.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Entry ${Number(c.entry_amount).toFixed(0)} · {(fee.rate * 100).toFixed(0)}%
                        fee
                      </div>
                      <div className="text-xs capitalize text-muted-foreground">{c.status}</div>
                    </div>
                  );
                })()}
                {c.status === "open" && c.creator_id !== user?.id && (
                  <Button
                    size="sm"
                    onClick={() => acceptChallenge(c.id)}
                    className="bg-gradient-brand text-primary-foreground"
                  >
                    Accept
                  </Button>
                )}
                {c.status === "open" && c.creator_id === user?.id && (
                  <Button size="sm" variant="outline" onClick={() => cancel(c.id)}>
                    <X className="mr-1 h-3 w-3" />
                    Cancel
                  </Button>
                )}
                {c.status === "active" &&
                  (c.creator_id === user?.id || c.opponent_id === user?.id) && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setReportFor(c)}
                        className="bg-gradient-brand text-primary-foreground"
                      >
                        <Trophy className="mr-1 h-3 w-3" />
                        Report result
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => concede(c.id)}>
                        <Flag className="mr-1 h-3 w-3" />
                        Concede
                      </Button>
                    </>
                  )}
                {c.status === "disputed" &&
                  (c.creator_id === user?.id || c.opponent_id === user?.id) && (
                    <span className="text-xs font-medium text-amber-500">
                      Under review by fair play team — funds locked
                    </span>
                  )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No challenges yet. Be the first.</p>
        )}
      </div>

      <Dialog
        open={!!reportFor}
        onOpenChange={(o) => {
          if (!o) setReportFor(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Who won this match?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Both players need to agree. If you and your opponent report different winners, funds are
            locked and our fair play team will review before anything is paid out.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Button
              onClick={() => reportResult(user?.id ?? "")}
              className="bg-gradient-brand text-primary-foreground"
            >
              I won
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const opponentId =
                  reportFor?.creator_id === user?.id
                    ? reportFor?.opponent_id
                    : reportFor?.creator_id;
                reportResult(opponentId);
              }}
            >
              My opponent won
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

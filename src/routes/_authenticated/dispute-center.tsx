import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminResolveChallenge } from "@/lib/matches.functions";
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
import { GAME_LABELS, type SupportedGame } from "@/lib/fees";
import { ShieldAlert, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dispute-center")({
  head: () => ({ meta: [{ title: "Dispute Center | MatchPoint" }] }),
  component: DisputePage,
});

function DisputePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ challenge_id: "", reason: "", evidence_url: "" });
  const resolveFn = useServerFn(adminResolveChallenge);
  const [resolving, setResolving] = useState<any>(null);

  // The button below calls adminResolveChallenge, which releases escrow and so
  // requires `moderation.disputes.approve`. This used to be `admin || moderator`
  // — moderators were shown a button that failed server-side every time.
  const { can } = useRoles();
  const canModerate = can("moderation.disputes.approve");

  /**
   * The matches this player can dispute.
   *
   * Kevin asked for match IDs rather than usernames, and the reason the old
   * free-text field was optional is that nobody could realistically supply a
   * UUID by hand. Given a picker, the reference can be required — and a dispute
   * that names its match is one a moderator can actually act on.
   *
   * Settled matches are included: a result being recorded is often exactly what
   * someone wants to dispute.
   */
  const { data: myMatches } = useQuery({
    queryKey: ["my-disputable-matches", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("challenges")
          .select(
            "id, game_slug, platform, entry_amount, status, created_at, creator_id, opponent_id",
          )
          .or(`creator_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
          .not("opponent_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });

  const { data: opponentNames } = useQuery({
    queryKey: ["disputable-opponents", user?.id, (myMatches ?? []).length],
    enabled: !!user && !!myMatches?.length,
    queryFn: async () => {
      const ids = Array.from(
        new Set(
          (myMatches ?? [])
            .map((m) => (m.creator_id === user!.id ? m.opponent_id : m.creator_id))
            .filter(Boolean) as string[],
        ),
      );
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", ids);
      const out: Record<string, string> = {};
      for (const p of data ?? []) out[p.id] = p.display_name || p.username || "Player";
      return out;
    },
  });

  const { data: disputes } = useQuery({
    queryKey: ["my-disputes", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("disputes")
          .select("*, challenge:challenges(*)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function resolve(winnerId: string) {
    if (!resolving) return;
    try {
      const r = await resolveFn({
        data: { challenge_id: resolving.challenge.id, winner_id: winnerId },
      });
      toast.success(`Resolved, $${(r.net_cents / 100).toFixed(2)} paid out.`);
      setResolving(null);
      qc.invalidateQueries({ queryKey: ["my-disputes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  async function submit() {
    if (!user) return;
    if (!form.challenge_id) return toast.error("Pick the match this dispute is about.");
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
          <Button className="mb-6 bg-gradient-brand text-primary-foreground">
            <Plus className="mr-2 h-4 w-4" />
            Open dispute
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open a dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Which match?</Label>
              <Select
                value={form.challenge_id}
                onValueChange={(v) => setForm({ ...form, challenge_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a match" />
                </SelectTrigger>
                <SelectContent>
                  {(myMatches ?? []).map((m) => {
                    const otherId = m.creator_id === user?.id ? m.opponent_id : m.creator_id;
                    const other = (otherId && opponentNames?.[otherId]) || "Opponent";
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        #{m.id.slice(0, 8).toUpperCase()} · vs {other} ·{" "}
                        {GAME_LABELS[m.game_slug as SupportedGame] ?? m.game_slug} · $
                        {Number(m.entry_amount ?? 0).toFixed(2)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {myMatches?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  You have no accepted matches to dispute yet.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                rows={4}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Evidence URL (screenshot/video)</Label>
              <Input
                value={form.evidence_url}
                onChange={(e) => setForm({ ...form, evidence_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <Button onClick={submit} className="w-full bg-gradient-brand text-primary-foreground">
              Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {disputes?.length ? (
          disputes.map((d) => (
            <div key={d.id} className="rounded-xl border border-border/60 bg-gradient-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 text-accent" />
                  <div>
                    <div className="text-sm font-medium">{d.reason}</div>
                    {d.evidence_url && (
                      <a
                        href={d.evidence_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View evidence
                      </a>
                    )}
                  </div>
                </div>
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                  {d.status}
                </span>
              </div>
              {(d as any).challenge && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> Funds locked, {(d as any).challenge.game_slug} · $
                  {Number((d as any).challenge.entry_amount).toFixed(2)} entry
                </div>
              )}
              {d.resolution && (
                <p className="mt-2 text-xs text-muted-foreground">Resolution: {d.resolution}</p>
              )}
              {canModerate && d.status === "open" && (d as any).challenge && (
                <Button
                  size="sm"
                  className="mt-3 bg-gradient-brand text-primary-foreground"
                  onClick={() => setResolving(d)}
                >
                  Resolve
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No disputes yet.</p>
        )}
      </div>

      <Dialog
        open={!!resolving}
        onOpenChange={(o) => {
          if (!o) setResolving(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve dispute. Pick the winner</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{resolving?.reason}</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Button
              onClick={() => resolve(resolving?.challenge?.creator_id)}
              className="bg-gradient-brand text-primary-foreground"
            >
              Creator won
            </Button>
            <Button variant="outline" onClick={() => resolve(resolving?.challenge?.opponent_id)}>
              Opponent won
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

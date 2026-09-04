import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Swords, Flag, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  acceptChallenge,
  reportChallengeResult,
  concedeChallenge,
  cancelChallenge,
} from "@/lib/matches.functions";
import { GAME_LABELS, calculateChallengeFee, type SupportedGame } from "@/lib/fees";
import { gameArt } from "@/lib/game-art";
import { timeAgo } from "@/components/marketplace/listing";
import { EvidenceUpload } from "@/components/match/EvidenceUpload";
import { SiteShell } from "@/components/site/SiteShell";
import { IconTile } from "@/components/ui/icon-tile";
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";

export const Route = createFileRoute("/match/$id")({
  /*
   * Module 11. These are the pages players actually share — "come play me" is
   * a link to a match lobby — and they were shipping with a generic title, no
   * description and no canonical, so every match unfurled identically in a
   * chat app. The player-profile route already had the right shape; this
   * matches it.
   *
   * The id is all that is available at head time (the lobby data is fetched in
   * the component), so the copy is written to be true without it.
   */
  head: ({ params }) => ({
    meta: [
      { title: "Match | MatchPoint" },
      {
        name: "description",
        content: "Follow this 1v1 match on MatchPoint, stake, players and result.",
      },
      { property: "og:title", content: "A match on MatchPoint" },
      { property: "og:url", content: `https://matchpointgaming.org/match/${params.id}` },
    ],
    links: [{ rel: "canonical", href: `https://matchpointgaming.org/match/${params.id}` }],
  }),
  component: MatchLobby,
});

type Player = {
  id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rank_tier: string | null;
};

function PlayerCard({
  player,
  label,
  isWinner,
}: {
  player: Player | null;
  label: string;
  isWinner: boolean;
}) {
  const name = player?.display_name || player?.username || (player?.id ? "Player" : "Waiting…");
  const initials = (player?.display_name || player?.username || "?").slice(0, 2).toUpperCase();

  const inner = (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl border p-6 text-center transition-colors ${
        isWinner ? "border-accent/40 bg-accent/10" : "border-border/60 bg-surface/30"
      }`}
    >
      <Avatar className="h-16 w-16 ring-1 ring-inset ring-white/10">
        <AvatarImage src={player?.avatar_url ?? undefined} alt="" />
        <AvatarFallback className="bg-gradient-to-b from-[oklch(0.27_0.062_285)] to-[oklch(0.195_0.048_285)] text-lg font-bold text-primary-glow">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 font-display text-xl tracking-wide">{name}</div>
        {player?.rank_tier && (
          <div className="mt-1 text-xs text-primary-glow">{player.rank_tier}</div>
        )}
      </div>
      {isWinner && <Status variant="accent">Winner</Status>}
    </div>
  );

  return player?.username ? (
    <Link to="/player/$username" params={{ username: player.username }}>
      {inner}
    </Link>
  ) : (
    inner
  );
}

function MatchLobby() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const acceptFn = useServerFn(acceptChallenge);
  const reportFn = useServerFn(reportChallengeResult);
  const concedeFn = useServerFn(concedeChallenge);
  const cancelFn = useServerFn(cancelChallenge);

  const { data: challenge, isLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () =>
      (await supabase.from("challenges").select("*").eq("id", id).maybeSingle()).data,
  });

  const ids = [challenge?.creator_id, challenge?.opponent_id].filter(Boolean) as string[];
  const { data: players = {} } = useQuery({
    queryKey: ["challenge-players", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_public")
        .select("id, username, display_name, avatar_url, rank_tier")
        .in("id", ids);
      const map: Record<string, Player> = {};
      for (const p of data ?? []) if (p.id) map[p.id] = p as Player;
      return map;
    },
  });

  if (isLoading) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <Skeleton className="h-10 w-2/3" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        </section>
      </SiteShell>
    );
  }

  if (!challenge) {
    return (
      <SiteShell>
        <section className="relative overflow-hidden">
          <BackgroundPattern />
          <div className="relative mx-auto grid max-w-2xl place-items-center px-4 py-28 text-center sm:px-6">
            <IconTile size="lg">
              <Swords className="h-5 w-5" />
            </IconTile>
            <h1 className="mt-5 font-display text-3xl tracking-wide">Match not found</h1>
            <Button asChild className="mt-7 bg-gradient-brand text-primary-foreground">
              <Link to="/marketplace">Browse the marketplace</Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  const fee = calculateChallengeFee(Number(challenge.entry_amount));
  const gameLabel = GAME_LABELS[challenge.game_slug as SupportedGame] ?? challenge.game_slug;
  const isCreator = !!user && user.id === challenge.creator_id;
  const isOpponent = !!user && user.id === challenge.opponent_id;
  const isParticipant = isCreator || isOpponent;
  const opponentId = isCreator ? challenge.opponent_id : challenge.creator_id;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["challenge", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function report(winnerId: string) {
    setBusy(true);
    try {
      const r = await reportFn({ data: { challenge_id: id, reported_winner_id: winnerId } });
      if (r.status === "waiting") toast.success("Recorded, waiting for your opponent to confirm.");
      else if (r.status === "settled")
        toast.success(`Settled, $${(r.net_cents / 100).toFixed(2)} paid out.`);
      else if (r.status === "disputed")
        toast.warning("You reported different winners. Funds are locked for review.");
      qc.invalidateQueries({ queryKey: ["challenge", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SiteShell>
      <section className="relative overflow-hidden border-b border-border/50">
        <BackgroundPattern />
        <div className="relative mx-auto max-w-4xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Status
              variant="brandSolid"
              className="px-2 py-0.5 text-[10px] uppercase tracking-wider"
            >
              {gameLabel}
            </Status>
            <Status variant="glass" className="px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]">
              <Swords />
              1v1
            </Status>
            {challenge.status === "open" && (
              <Status variant="success">
                <StatusIndicator />
                <StatusLabel>Open</StatusLabel>
              </Status>
            )}
            {challenge.status === "disputed" && (
              <Status variant="warning">
                <StatusIndicator />
                <StatusLabel>Under review</StatusLabel>
              </Status>
            )}
            {challenge.status === "settled" && <Status variant="success">Settled</Status>}
            {challenge.status === "active" && <Status variant="info">In progress</Status>}
          </div>

          <h1 className="mt-4 font-display text-4xl tracking-wide sm:text-5xl">
            {gameLabel} · {challenge.platform}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {challenge.rules?.trim() || "Standard rules"} · posted {timeAgo(challenge.created_at)}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-8">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Winner takes
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide text-accent">
                ${fee.netPrize.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Entry each
              </div>
              <div className="mt-1 font-display text-3xl tracking-wide">
                ${Number(challenge.entry_amount).toFixed(0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl space-y-8 px-4 py-12 sm:px-6">
        {/* Players */}
        <div className="grid gap-4 sm:grid-cols-2">
          <PlayerCard
            player={
              players[challenge.creator_id] ?? {
                id: challenge.creator_id,
                username: null,
                display_name: null,
                avatar_url: null,
                rank_tier: null,
              }
            }
            label="Challenger"
            isWinner={challenge.winner_id === challenge.creator_id}
          />
          <PlayerCard
            player={challenge.opponent_id ? (players[challenge.opponent_id] ?? null) : null}
            label="Opponent"
            isWinner={!!challenge.opponent_id && challenge.winner_id === challenge.opponent_id}
          />
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-border/60 bg-gradient-card p-6">
          <h3 className="font-semibold">Match actions</h3>

          {!user && (
            <div className="mt-4">
              <Button asChild className="bg-gradient-brand text-primary-foreground">
                <Link to="/login">Sign in to play</Link>
              </Button>
            </div>
          )}

          {user && challenge.status === "open" && !isCreator && (
            <Button
              disabled={busy}
              onClick={() =>
                run("Accepted. Your stake is in escrow. GL!", () =>
                  acceptFn({ data: { challenge_id: id } }),
                )
              }
              className="mt-4 bg-gradient-brand text-primary-foreground"
            >
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Accept challenge
            </Button>
          )}

          {user && challenge.status === "open" && isCreator && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() =>
                run("Cancelled, stake refunded.", () => cancelFn({ data: { challenge_id: id } }))
              }
              className="mt-4"
            >
              Cancel challenge
            </Button>
          )}

          {user && challenge.status === "active" && isParticipant && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Both players must report the same winner. If you disagree, funds are locked and our
                fair play team reviews the evidence below.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={busy}
                  onClick={() => report(user.id)}
                  className="bg-gradient-brand text-primary-foreground"
                >
                  {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}I won
                </Button>
                {opponentId && (
                  <Button disabled={busy} variant="outline" onClick={() => report(opponentId)}>
                    My opponent won
                  </Button>
                )}
                <Button
                  disabled={busy}
                  variant="ghost"
                  onClick={() => run("Conceded.", () => concedeFn({ data: { challenge_id: id } }))}
                >
                  <Flag className="mr-1.5 h-4 w-4" />
                  Concede
                </Button>
              </div>
            </div>
          )}

          {challenge.status === "disputed" && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The players reported different winners. Funds are locked until a moderator reviews
                the evidence.
              </span>
            </div>
          )}
        </div>

        {/* Evidence — participants only */}
        {user && isParticipant && (
          <EvidenceUpload
            userId={user.id}
            challengeId={id}
            canUpload={challenge.status !== "settled"}
          />
        )}
      </section>
    </SiteShell>
  );
}

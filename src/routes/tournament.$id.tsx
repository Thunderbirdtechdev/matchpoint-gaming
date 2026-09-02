import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trophy, Users, CalendarClock, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { generateBracket, reportMatchResult } from "@/lib/bracket.functions";
import { joinTournament, declareTournamentWinner } from "@/lib/matches.functions";
import { GAME_LABELS, calculateTournamentFee, type SupportedGame } from "@/lib/fees";
import { gameArt } from "@/lib/game-art";
import { FORMAT_LABELS, startsIn } from "@/components/marketplace/listing";
import {
  BracketView,
  BracketChampion,
  type BracketMatch,
} from "@/components/tournament/BracketView";
import { SiteShell } from "@/components/site/SiteShell";
import { IconTile } from "@/components/ui/icon-tile";
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";

export const Route = createFileRoute("/tournament/$id")({
  head: () => ({ meta: [{ title: "Tournament — MatchPoint" }] }),
  component: TournamentLobby,
});

function TournamentLobby() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const generateFn = useServerFn(generateBracket);
  const reportFn = useServerFn(reportMatchResult);
  const joinFn = useServerFn(joinTournament);
  const declareFn = useServerFn(declareTournamentWinner);

  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: tournament, isLoading } = useQuery({
    queryKey: ["tournament", id],
    queryFn: async () =>
      (await supabase.from("tournaments").select("*").eq("id", id).maybeSingle()).data,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["tournament-entries", id],
    queryFn: async () =>
      (await supabase.from("tournament_entries").select("user_id").eq("tournament_id", id)).data ??
      [],
  });

  const { data: bracket = [] } = useQuery({
    queryKey: ["tournament-bracket", id],
    queryFn: async () =>
      ((await supabase.from("tournament_bracket").select("*").eq("tournament_id", id)).data ??
        []) as BracketMatch[],
  });

  const { data: host } = useQuery({
    queryKey: ["tournament-host", tournament?.host_id],
    enabled: !!tournament?.host_id,
    queryFn: async () =>
      (
        await supabase
          .from("player_public")
          .select("username, display_name")
          .eq("id", tournament!.host_id)
          .maybeSingle()
      ).data,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
          <Skeleton className="h-10 w-2/3" />
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="mt-8 h-64 rounded-2xl" />
        </section>
      </SiteShell>
    );
  }

  if (!tournament) {
    return (
      <SiteShell>
        <section className="relative overflow-hidden">
          <BackgroundPattern />
          <div className="relative mx-auto grid max-w-2xl place-items-center px-4 py-28 text-center sm:px-6">
            <IconTile size="lg">
              <Trophy className="h-5 w-5" />
            </IconTile>
            <h1 className="mt-5 font-display text-3xl tracking-wide">Tournament not found</h1>
            <Button asChild className="mt-7 bg-gradient-brand text-primary-foreground">
              <Link to="/marketplace">Browse the marketplace</Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  const isHost = !!user && user.id === tournament.host_id;
  const isEntrant = !!user && entries.some((e) => e.user_id === user.id);
  const players = entries.length;
  const maxPlayers = tournament.max_players ?? 0;
  const filled = maxPlayers > 0 ? Math.round((players / maxPlayers) * 100) : 0;
  const gameLabel = GAME_LABELS[tournament.game_slug as SupportedGame] ?? tournament.game_slug;
  const entry = Number(tournament.entry_fee ?? 0);
  const declaredPool = Number(tournament.prize_pool ?? 0);
  const prize =
    declaredPool > 0 ? declaredPool : calculateTournamentFee(entry, maxPlayers).netPrize;

  const finalRound = bracket.length ? Math.max(...bracket.map((m) => m.round ?? 1)) : 0;
  const finalMatch = bracket.find((m) => m.round === finalRound && m.slot === 0);
  const champion =
    finalMatch?.status === "settled" && finalMatch.winner_id
      ? finalMatch.winner_id === finalMatch.player1_id
        ? {
            id: finalMatch.player1_id,
            name: finalMatch.player1_name || finalMatch.player1_username || "Champion",
            username: finalMatch.player1_username,
          }
        : {
            id: finalMatch.player2_id,
            name: finalMatch.player2_name || finalMatch.player2_username || "Champion",
            username: finalMatch.player2_username,
          }
      : null;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["tournament-bracket", id] });
      qc.invalidateQueries({ queryKey: ["tournament", id] });
      qc.invalidateQueries({ queryKey: ["tournament-entries", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onReport(matchId: string, winnerId: string) {
    setPendingMatchId(matchId);
    try {
      const res = await reportFn({ data: { match_id: matchId, winner_id: winnerId } });
      toast.success(res.is_final ? "Final settled — we have a champion." : "Result recorded.");
      qc.invalidateQueries({ queryKey: ["tournament-bracket", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not report result");
    } finally {
      setPendingMatchId(null);
    }
  }

  return (
    <SiteShell>
      {/* Header */}
      <section className="relative overflow-hidden border-b border-border/50">
        <BackgroundPattern />
        <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
            <img
              src={gameArt(tournament.game_slug)}
              alt={gameLabel}
              className="h-28 w-44 shrink-0 rounded-xl object-cover ring-1 ring-inset ring-white/10"
              width={352}
              height={224}
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Status
                  variant="brandSolid"
                  className="px-2 py-0.5 text-[10px] uppercase tracking-wider"
                >
                  {gameLabel}
                </Status>
                {tournament.status === "open" || tournament.status === "upcoming" ? (
                  <Status variant="success">
                    <StatusIndicator />
                    <StatusLabel>Open</StatusLabel>
                  </Status>
                ) : (
                  <Status variant="default">{tournament.status}</Status>
                )}
              </div>
              <h1 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl">
                {tournament.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Hosted by {host?.display_name || host?.username || "a player"}
                {tournament.starts_at ? ` · ${startsIn(tournament.starts_at)}` : ""}
              </p>
            </div>

            {!isHost &&
              !isEntrant &&
              (tournament.status === "open" || tournament.status === "upcoming") && (
                <Button
                  disabled={busy || !user}
                  onClick={() =>
                    user
                      ? run("You're in — entry held in escrow.", () =>
                          joinFn({ data: { tournament_id: id } }),
                        )
                      : undefined
                  }
                  asChild={!user}
                  className="bg-gradient-brand text-primary-foreground"
                >
                  {user ? (
                    <span>
                      {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Join tournament
                    </span>
                  ) : (
                    <Link to="/login">Sign in to join</Link>
                  )}
                </Button>
              )}
          </div>

          {tournament.description && (
            <p className="mt-6 max-w-3xl text-muted-foreground">{tournament.description}</p>
          )}
        </div>
      </section>

      {/* Facts */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<Trophy />} label="Prize pool" value={`$${prize.toFixed(2)}`} accent />
          <Fact
            icon={<Gamepad2 />}
            label="Entry"
            value={entry > 0 ? `$${entry.toFixed(0)}` : "Free"}
          />
          <Fact icon={<Users />} label="Players" value={`${players}/${maxPlayers}`}>
            <Progress value={filled} className="mt-2 h-1.5" />
          </Fact>
          <Fact
            icon={<CalendarClock />}
            label="Format"
            value={FORMAT_LABELS[tournament.format] ?? tournament.format}
          />
        </div>

        {/* Bracket */}
        <div className="mt-12">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl tracking-wide">Bracket</h2>
            {isHost && bracket.length === 0 && (
              <Button
                disabled={busy || players < 2}
                onClick={() =>
                  run("Bracket generated.", () => generateFn({ data: { tournament_id: id } }))
                }
                className="bg-gradient-brand text-primary-foreground"
              >
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Generate bracket
              </Button>
            )}
          </div>

          {isHost && bracket.length === 0 && players < 2 && (
            <p className="mb-4 text-sm text-muted-foreground">
              At least 2 entrants are needed before a bracket can be drawn.
            </p>
          )}

          <BracketView
            matches={bracket}
            isHost={isHost}
            pendingMatchId={pendingMatchId}
            onReport={onReport}
          />

          {champion && (
            <BracketChampion
              name={champion.name}
              username={champion.username}
              isHost={isHost}
              settling={busy}
              onSettle={
                tournament.status === "completed"
                  ? undefined
                  : () =>
                      run("Prize money released.", () =>
                        declareFn({
                          data: {
                            tournament_id: id,
                            winners: [{ user_id: champion.id!, place: 1 }],
                          },
                        }),
                      )
              }
            />
          )}
        </div>
      </section>
    </SiteShell>
  );
}

function Fact({
  icon,
  label,
  value,
  accent,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/30 p-4">
      <div className="flex items-center gap-2">
        <IconTile size="sm">{icon}</IconTile>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={`mt-3 font-display text-2xl tracking-wide ${accent ? "text-accent" : "text-foreground"}`}
      >
        {value}
      </div>
      {children}
    </div>
  );
}

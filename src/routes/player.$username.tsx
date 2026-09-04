import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserX, Swords } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { PremiumCard } from "@/components/ui/premium-card";
import { IconTile } from "@/components/ui/icon-tile";
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";
import { GAME_LABELS, type SupportedGame } from "@/lib/fees";

export const Route = createFileRoute("/player/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username}, MatchPoint` },
      {
        name: "description",
        content: `See @${params.username}'s record, earnings and rank on MatchPoint.`,
      },
      { property: "og:title", content: `@${params.username} on MatchPoint` },
      { property: "og:url", content: `https://matchpointgaming.org/player/${params.username}` },
    ],
    links: [{ rel: "canonical", href: `https://matchpointgaming.org/player/${params.username}` }],
  }),
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { username } = Route.useParams();

  // player_public is a view that exposes only shareable columns — never email,
  // date of birth, country or wallet balance.
  const { data: player, isLoading } = useQuery({
    queryKey: ["player-public", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("player_public")
        .select("*")
        .eq("username", username.toLowerCase())
        .maybeSingle();
      return data;
    },
  });

  // View columns come back nullable, so narrow the id before querying by it.
  const playerId = player?.id ?? null;

  const { data: stats } = useQuery({
    queryKey: ["player-public-stats", playerId],
    enabled: playerId !== null,
    queryFn: async () => {
      const { data } = await supabase
        .from("player_stats")
        .select("matches_played, wins, losses, earnings")
        .eq("user_id", playerId as string)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <SiteShell>
        <section className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        </section>
      </SiteShell>
    );
  }

  if (!player) {
    return (
      <SiteShell>
        <section className="relative overflow-hidden">
          <BackgroundPattern />
          <div className="relative mx-auto grid max-w-2xl place-items-center px-4 py-28 text-center sm:px-6">
            <IconTile size="lg">
              <UserX className="h-5 w-5" />
            </IconTile>
            <h1 className="mt-5 font-display text-3xl tracking-wide">Player not found</h1>
            <p className="mt-3 text-muted-foreground">
              No MatchPoint player goes by <span className="text-foreground">@{username}</span>.
            </p>
            <Button asChild className="mt-7 bg-gradient-brand text-primary-foreground">
              <Link to="/marketplace">Browse the marketplace</Link>
            </Button>
          </div>
        </section>
      </SiteShell>
    );
  }

  const name = player.display_name || player.username || "Anonymous";
  const initials = name.slice(0, 2).toUpperCase();
  const played = stats?.matches_played ?? 0;
  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const gameLabel = player.favorite_game
    ? (GAME_LABELS[player.favorite_game as SupportedGame] ?? player.favorite_game)
    : null;
  const memberSince = player.created_at
    ? new Date(player.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <SiteShell>
      {/* Identity */}
      <section className="relative overflow-hidden border-b border-border/50">
        <BackgroundPattern />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 md:py-20">
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-end sm:text-left">
            <Avatar className="h-24 w-24 ring-1 ring-inset ring-white/10">
              <AvatarImage src={player.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-gradient-to-b from-[oklch(0.27_0.062_285)] to-[oklch(0.195_0.048_285)] text-2xl font-bold text-primary-glow">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-display text-4xl tracking-wide sm:text-5xl">{name}</h1>
                {player.is_age_verified && (
                  <Status variant="success">
                    <StatusIndicator />
                    <StatusLabel>Verified</StatusLabel>
                  </Status>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">@{player.username}</p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Status variant="brand">{player.rank_tier ?? "Bronze"}</Status>
                {gameLabel && <Status variant="default">{gameLabel}</Status>}
                {player.platform && <Status variant="default">{player.platform}</Status>}
                {player.region && <Status variant="default">{player.region}</Status>}
              </div>
            </div>

            <Button asChild className="bg-gradient-brand text-primary-foreground">
              <Link to="/marketplace">
                <Swords className="mr-1.5 h-4 w-4" />
                Challenge a player
              </Link>
            </Button>
          </div>

          {player.bio && (
            <p className="mx-auto mt-8 max-w-2xl text-center text-muted-foreground sm:mx-0 sm:text-left">
              {player.bio}
            </p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Record"
            value={played > 0 ? `${wins}-${losses}` : "-"}
            sub="Wins–losses"
          />
          <StatCard
            label="Win rate"
            value={played > 0 ? `${winRate}%` : "-"}
            sub={`${played} matches`}
          />
          <StatCard
            label="Earnings"
            value={`$${Number(stats?.earnings ?? 0).toFixed(2)}`}
            sub="Net of platform fees"
            accent
          />
          <StatCard
            label="Reputation"
            value={player.reputation ?? 100}
            sub={`${player.xp ?? 0} XP`}
          />
        </div>

        {played === 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {name} hasn&rsquo;t settled a match yet.
          </p>
        )}

        {memberSince && (
          <p className="mt-8 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
            Member since {memberSince}
          </p>
        )}
      </section>
    </SiteShell>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <PremiumCard>
      <div className="p-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-2 font-display text-3xl tracking-wide ${accent ? "text-accent" : "text-foreground"}`}
        >
          {value}
        </div>
        {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </PremiumCard>
  );
}

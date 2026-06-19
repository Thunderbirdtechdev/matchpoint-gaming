import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Medal, Crown } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";

const players = [
  { rank: 1, name: "NovaStrike", game: "Fortnite", wins: 412, wr: 78, rep: 4980 },
  { rank: 2, name: "VortexKing", game: "Call of Duty", wins: 389, wr: 74, rep: 4870 },
  { rank: 3, name: "ApexQueen", game: "NBA 2K", wins: 362, wr: 81, rep: 4750 },
  { rank: 4, name: "GhostPivot", game: "EA Sports FC", wins: 341, wr: 71, rep: 4612 },
  { rank: 5, name: "IronGrid", game: "Madden NFL", wins: 318, wr: 69, rep: 4501 },
  { rank: 6, name: "SilentReign", game: "Fortnite", wins: 305, wr: 72, rep: 4422 },
  { rank: 7, name: "PixelHawk", game: "Call of Duty", wins: 297, wr: 70, rep: 4380 },
  { rank: 8, name: "ClutchSorcery", game: "MLB The Show", wins: 281, wr: 73, rep: 4301 },
  { rank: 9, name: "TitanCascade", game: "NBA 2K", wins: 274, wr: 68, rep: 4250 },
  { rank: 10, name: "EclipseWolf", game: "EA Sports FC", wins: 269, wr: 66, rep: 4188 },
];

export const Route = createFileRoute("/leaderboards")({
  head: () => ({
    meta: [
      { title: "Leaderboards — MatchPoint" },
      { name: "description", content: "Global rankings: most wins, highest win rate, tournament wins and reputation score." },
      { property: "og:title", content: "Leaderboards — MatchPoint" },
      { property: "og:description", content: "The top players competing on MatchPoint right now." },
    ],
  }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Leaderboards"
        title={<>The world's <span className="text-gradient-brand">best</span> right now</>}
        description="Global, monthly and season rankings. Updated live as matches complete."
      />

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-card shadow-card">
          <div className="grid grid-cols-12 gap-4 border-b border-border/50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-5 sm:col-span-4">Player</div>
            <div className="col-span-3 hidden sm:block">Main Game</div>
            <div className="col-span-3 sm:col-span-2 text-right">Wins</div>
            <div className="col-span-3 sm:col-span-2 text-right">Win %</div>
          </div>
          {players.map((p) => (
            <div
              key={p.rank}
              className="grid grid-cols-12 items-center gap-4 border-b border-border/30 px-6 py-4 text-sm transition-colors last:border-0 hover:bg-surface/60"
            >
              <div className="col-span-1">
                <RankBadge rank={p.rank} />
              </div>
              <div className="col-span-5 sm:col-span-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Rep {p.rep}</div>
                  </div>
                </div>
              </div>
              <div className="col-span-3 hidden text-muted-foreground sm:block">{p.game}</div>
              <div className="col-span-3 text-right font-bold sm:col-span-2">{p.wins}</div>
              <div className="col-span-3 text-right font-bold text-accent sm:col-span-2">{p.wr}%</div>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-accent" />;
  if (rank === 2) return <Trophy className="h-5 w-5 text-muted-foreground" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-secondary" />;
  return <span className="text-sm font-bold text-muted-foreground">{rank}</span>;
}

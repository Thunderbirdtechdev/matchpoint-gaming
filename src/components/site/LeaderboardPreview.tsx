import { Link } from "@tanstack/react-router";
import { Trophy, TrendingUp, Crown, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";

const top = [
  { rank: 1, handle: "@apex.zero", game: "Call of Duty", wins: 412, earnings: "$18,420" },
  { rank: 2, handle: "@bucketboy", game: "NBA 2K", wins: 378, earnings: "$14,910" },
  { rank: 3, handle: "@gridironGod", game: "Madden NFL", wins: 341, earnings: "$12,650" },
  { rank: 4, handle: "@buildbattle", game: "Fortnite", wins: 309, earnings: "$11,200" },
  { rank: 5, handle: "@walkoffking", game: "MLB The Show", wins: 287, earnings: "$9,840" },
];

const rankIcon = (r: number) => {
  if (r === 1) return <Crown className="h-4 w-4 text-accent" />;
  if (r === 2) return <Medal className="h-4 w-4 text-secondary" />;
  if (r === 3) return <Medal className="h-4 w-4 text-primary" />;
  return <span className="text-xs font-bold text-muted-foreground">#{r}</span>;
};

export function LeaderboardPreview() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              Leaderboards
            </p>
            <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">
              Climb the global ranks
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every win moves you up. Top earners get featured, sponsored and invited
              to seasonal championship events with bigger prize pools.
            </p>
            <div className="mt-6 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                Season resets monthly
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-accent" />
                Live rank updates
              </div>
            </div>
            <Button
              asChild
              className="mt-8 bg-gradient-brand font-bold uppercase tracking-wider text-primary-foreground hover:opacity-90"
            >
              <Link to="/register">Get on the Board</Link>
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-gradient-card shadow-card">
            <div className="grid grid-cols-[60px_1fr_120px_100px] gap-4 border-b border-border/50 bg-background/40 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Rank</span>
              <span>Player</span>
              <span className="hidden sm:block">Game</span>
              <span className="text-right">Earnings</span>
            </div>
            <ul>
              {top.map((p) => (
                <li
                  key={p.handle}
                  className="grid grid-cols-[60px_1fr_120px_100px] items-center gap-4 border-b border-border/30 px-5 py-4 text-sm transition-colors last:border-0 hover:bg-background/30"
                >
                  <div className="flex h-6 w-6 items-center justify-center">
                    {rankIcon(p.rank)}
                  </div>
                  <div>
                    <div className="font-semibold">{p.handle}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.wins.toLocaleString()} wins
                    </div>
                  </div>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {p.game}
                  </span>
                  <span className="text-right font-display text-base font-bold text-gradient-brand">
                    {p.earnings}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

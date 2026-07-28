import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Zap, Shield, Swords, Crown, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

const liveMatch = {
  game: "Call of Duty · Search & Destroy",
  stake: "$50",
  timer: "12:04",
  a: { handle: "@apex.zero", record: "412W · 61L", score: 4 },
  b: { handle: "@nightfall", record: "298W · 88L", score: 3 },
};

const topThree = [
  { rank: 1, handle: "@apex.zero", earnings: "$18,420" },
  { rank: 2, handle: "@bucketboy", earnings: "$14,910" },
  { rank: 3, handle: "@gridironGod", earnings: "$12,650" },
];

const trust = [
  { icon: Shield, label: "Verified matches" },
  { icon: Zap, label: "Fast payouts" },
  { icon: Swords, label: "Anti-cheat enforced" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 grid-pattern opacity-40" />
      <div className="absolute -left-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-32 top-40 h-[26rem] w-[26rem] rounded-full bg-primary-glow/15 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 md:pb-28 md:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-12">
          {/* Left — message */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-accent backdrop-blur">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              Season 1 · Live Now
            </div>

            <h1 className="mt-7 font-display text-7xl leading-[0.88] tracking-wide sm:text-8xl md:text-[7.5rem]">
              <span className="block">Play. Compete.</span>
              <span className="mt-1 block text-gradient-brand">Win.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              The skill-based arena for serious gamers. Throw down 1v1 challenges, drop
              into tournaments, and cash out what you earn.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="h-12 bg-gradient-brand px-7 font-display text-lg tracking-[0.12em] text-primary-foreground glow-primary transition-all hover:scale-[1.02] hover:opacity-95"
              >
                <Link to="/register">
                  Enter the Arena
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-border/80 bg-surface/40 px-7 font-display text-lg tracking-[0.12em] backdrop-blur hover:bg-surface"
              >
                <Link to="/games">
                  <Play className="mr-1 h-4 w-4" />
                  Browse Games
                </Link>
              </Button>
            </div>

            <ul className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/50 pt-6">
              {trust.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <t.icon className="h-4 w-4 shrink-0 text-primary-glow" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — live arena panel */}
          <div className="relative animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
            <img
              src={heroBg}
              alt=""
              width={1920}
              height={1080}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-3xl object-cover opacity-15"
            />

            <div className="relative space-y-4">
              {/* Live match card */}
              <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-elevated backdrop-blur">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                      Live
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{liveMatch.game}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    {liveMatch.timer}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                  <Player {...liveMatch.a} />
                  <div className="shrink-0 text-center">
                    <div className="font-display text-3xl tracking-wide text-gradient-brand">
                      {liveMatch.a.score}–{liveMatch.b.score}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Score
                    </div>
                  </div>
                  <Player {...liveMatch.b} align="right" />
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Stake
                  </span>
                  <span className="font-display text-xl tracking-wide text-accent">
                    {liveMatch.stake}
                  </span>
                </div>
              </div>

              {/* Top 3 strip */}
              <div className="rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-card backdrop-blur">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  <Crown className="h-3.5 w-3.5 text-accent" />
                  Season leaders
                </div>
                <ul className="mt-3 divide-y divide-border/40">
                  {topThree.map((p) => (
                    <li key={p.handle} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                      <span className="shrink-0 font-display text-base tracking-wide text-muted-foreground">
                        {p.rank}
                      </span>
                      <span className="truncate text-sm font-medium">{p.handle}</span>
                      <span className="shrink-0 font-display text-base tracking-wide text-accent">
                        {p.earnings}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Prize pool counter */}
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 backdrop-blur">
                <span className="min-w-0 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  Prize pools paid out
                </span>
                <span className="shrink-0 font-display text-2xl tracking-wide text-gradient-brand">
                  $2.4M
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Player({
  handle,
  record,
  align = "left",
}: {
  handle: string;
  record: string;
  score?: number;
  align?: "left" | "right";
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <div className="truncate text-sm font-semibold">{handle}</div>
      <div className="truncate text-xs text-muted-foreground">{record}</div>
    </div>
  );
}

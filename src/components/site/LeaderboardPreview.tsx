import { Link } from "@tanstack/react-router";
import { Trophy, TrendingUp, Crown, Medal, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

const top = [
  { rank: 1, handle: "@buildbattle", game: "Fortnite", wins: 412, earnings: "$18,420", amount: 18420 },
  { rank: 2, handle: "@bucketboy", game: "NBA 2K", wins: 378, earnings: "$14,910", amount: 14910 },
  { rank: 3, handle: "@gridironGod", game: "Madden NFL", wins: 341, earnings: "$12,650", amount: 12650 },
  { rank: 4, handle: "@clutchQB", game: "College Football", wins: 309, earnings: "$11,200", amount: 11200 },
  { rank: 5, handle: "@dimeDropper", game: "NBA 2K", wins: 287, earnings: "$9,840", amount: 9840 },
];

/** Monthly platform earnings trend (6 months) */
const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
const monthlyEarnings = [32, 45, 41, 58, 72, 67]; // in thousands
const maxEarning = Math.max(...monthlyEarnings);

function buildPath(data: number[], width: number, height: number, padding = 0) {
  const stepX = (width - padding * 2) / (data.length - 1);
  const points = data.map((v, i) => ({
    x: padding + i * stepX,
    y: height - padding - ((v / maxEarning) * (height - padding * 2)),
  }));

  // smooth curve
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.4;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.6;
    d += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // area fill path
  const areaD = `${d} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { linePath: d, areaPath: areaD, points };
}

function AreaChart({ visible }: { visible: boolean }) {
  const w = 360;
  const h = 140;
  const pad = 20;
  const { linePath, areaPath, points } = buildPath(monthlyEarnings, w, h, pad);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h + 24}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.51 0.23 277 / 0.25)" />
            <stop offset="100%" stopColor="oklch(0.51 0.23 277 / 0.02)" />
          </linearGradient>
          <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="oklch(0.51 0.23 277)" />
            <stop offset="100%" stopColor="oklch(0.66 0.19 279)" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75].map((frac) => (
          <line
            key={frac}
            x1={pad}
            x2={w - pad}
            y1={pad + (h - pad * 2) * frac}
            y2={pad + (h - pad * 2) * frac}
            stroke="oklch(0.5 0.02 280 / 0.12)"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill="url(#area-fill)"
          className="transition-opacity duration-1000"
          style={{ opacity: visible ? 1 : 0, transitionDelay: "600ms" }}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#line-gradient)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="leaderboard-chart-line"
          style={{
            strokeDasharray: 600,
            strokeDashoffset: visible ? 0 : 600,
            transition: "stroke-dashoffset 1.5s ease-out 400ms",
          }}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            {/* Glow */}
            <circle
              cx={p.x}
              cy={p.y}
              r={6}
              fill="oklch(0.51 0.23 277 / 0.2)"
              className="transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "scale(1)" : "scale(0)",
                transformOrigin: `${p.x}px ${p.y}px`,
                transitionDelay: `${i * 120 + 800}ms`,
              }}
            />
            {/* Dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={3}
              fill="oklch(0.58 0.22 277)"
              stroke="oklch(0.12 0.02 280)"
              strokeWidth={1.5}
              className="transition-all duration-500"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? "scale(1)" : "scale(0)",
                transformOrigin: `${p.x}px ${p.y}px`,
                transitionDelay: `${i * 120 + 800}ms`,
              }}
            />
            {/* Value label */}
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              className="fill-foreground font-display text-[9px] transition-opacity duration-500"
              style={{
                opacity: visible ? 0.7 : 0,
                transitionDelay: `${i * 120 + 1000}ms`,
              }}
            >
              ${monthlyEarnings[i]}K
            </text>
            {/* Month label */}
            <text
              x={p.x}
              y={h + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px] transition-opacity duration-500"
              style={{
                opacity: visible ? 0.5 : 0,
                transitionDelay: `${i * 120 + 1000}ms`,
              }}
            >
              {months[i]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/30">
        <Crown className="h-4 w-4 text-accent" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/30">
        <Medal className="h-4 w-4 text-primary-glow" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
        <Medal className="h-4 w-4 text-primary" />
      </div>
    );
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface/80 ring-1 ring-border/40">
      <span className="font-display text-sm text-muted-foreground">{rank}</span>
    </div>
  );
}

export function LeaderboardPreview() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setVisible(true);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <section ref={sectionRef} className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.5fr]">
          {/* Left — text */}
          <div
            className={`transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">Leaderboards</p>
            <h2 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl md:text-6xl">
              Climb the Global{" "}
              <span className="text-gradient-brand">Ranks</span>
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every win moves you up. Top earners get featured, sponsored and invited
              to seasonal championship events with bigger prize pools.
            </p>

            <div className="mt-6 flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Trophy className="h-4 w-4 shrink-0 text-primary-glow" />
                Season resets monthly
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
                Live rank updates
              </div>
            </div>

            {/* Animated CTA button */}
            <Link
              to="/register"
              className="leaderboard-cta group relative mt-8 inline-flex h-13 items-center gap-3 overflow-hidden rounded-xl bg-gradient-brand px-8 font-display text-base uppercase tracking-[0.12em] text-primary-foreground transition-all duration-300 hover:shadow-[0_0_30px_oklch(0.51_0.23_277_/_0.35)]"
            >
              <span className="absolute inset-0 leaderboard-btn-shimmer" />
              <span className="relative">Get on the Board</span>
              <ArrowRight className="relative h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Right — table + chart */}
          <div
            className={`transition-all duration-700 delay-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <div className="relative">
              {/* Card border glow */}
              <div
                className="absolute -inset-px rounded-2xl"
                style={{
                  background: "linear-gradient(180deg, oklch(0.6 0.15 277 / 0.35) 0%, oklch(0.4 0.08 280 / 0.12) 50%, oklch(0.6 0.15 277 / 0.2) 100%)",
                }}
              />

              <div className="relative overflow-hidden rounded-2xl bg-background">
                {/* Table header */}
                <div className="grid grid-cols-[44px_minmax(0,1fr)_100px] items-center gap-3 border-b border-border/30 px-5 py-3.5 font-display text-[10px] tracking-[0.2em] uppercase text-muted-foreground sm:grid-cols-[44px_minmax(0,1fr)_100px_100px]">
                  <span>Rank</span>
                  <span>Player</span>
                  <span className="hidden sm:block">Game</span>
                  <span className="text-right">Earnings</span>
                </div>

                {/* Rows */}
                {top.map((p, i) => (
                  <div
                    key={p.handle}
                    className={`grid grid-cols-[44px_minmax(0,1fr)_100px] items-center gap-3 px-5 py-4 text-sm transition-all duration-700 sm:grid-cols-[44px_minmax(0,1fr)_100px_100px] ${
                      i < top.length - 1 ? "border-b border-border/15" : ""
                    } ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"}`}
                    style={{ transitionDelay: `${i * 120 + 400}ms` }}
                  >
                    <RankBadge rank={p.rank} />

                    <div className="min-w-0">
                      <div className="truncate font-semibold">{p.handle}</div>
                      <div className="text-xs text-muted-foreground">{p.wins.toLocaleString()} wins</div>
                    </div>

                    <span className="hidden truncate text-xs text-muted-foreground sm:block">{p.game}</span>

                    <div className="text-right">
                      <span className="font-display text-base tracking-wide text-foreground">{p.earnings}</span>
                    </div>
                  </div>
                ))}

                {/* Area chart */}
                <div className="border-t border-border/20 px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    <span className="font-display text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                      Platform Prize Pool — Last 6 Months
                    </span>
                  </div>
                  <AreaChart visible={visible} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

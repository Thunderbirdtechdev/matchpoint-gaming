import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Landmark, HeadsetIcon, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useCallback, type MouseEvent } from "react";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
import cardNcaa from "@/assets/card-ncaa.jpg";

const tournaments = [
  { game: "Fortnite", title: "Fortnite Box Fight Showdown", img: cardFortnite },
  { game: "NBA 2K", title: "NBA 2K Pro League", img: cardNba2k },
  { game: "Madden NFL", title: "Madden Championship Series", img: cardMadden },
  { game: "College Football", title: "CFB 25 Rivalry Cup", img: cardNcaa },
];

const trustStrip = [
  { icon: ShieldCheck, label: "Fair Play", sub: "Every match verified" },
  { icon: Landmark, label: "Secure Payouts", sub: "Powered by Stripe" },
  { icon: HeadsetIcon, label: "24/7 Support", sub: "We've got your back" },
  { icon: Trophy, label: "Compete & Win", sub: "Real cash prizes" },
];

/** Cursor-tracking spotlight + tilt for a card */
function useSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = x / rect.width - 0.5;
    const cy = y / rect.height - 0.5;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);
    el.style.setProperty("--tilt-x", `${cy * -4}deg`);
    el.style.setProperty("--tilt-y", `${cx * 6}deg`);
  }, []);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return { ref, onMove, onLeave };
}

function TournamentCard({ t }: { t: (typeof tournaments)[number] }) {
  const { ref, onMove, onLeave } = useSpotlight();

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="premium-card group relative overflow-hidden rounded-xl bg-background/60 backdrop-blur"
      style={{ perspective: "800px" }}
    >
      {/* Gradient border layer */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-border/50 via-border/30 to-border/50 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:from-primary/50 group-hover:via-primary/20 group-hover:to-primary/50" />

      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(400px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.08), transparent 60%)",
        }}
      />

      {/* Inner card */}
      <div
        className="relative rounded-[11px] bg-background/80 transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-1"
        style={{
          transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translateY(var(--lift, 0px))",
        }}
      >
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-[11px]">
          <img
            src={t.img}
            alt={t.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            width={640}
            height={360}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <span className="rounded-md bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-glow backdrop-blur-sm">
              {t.game}
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h4 className="text-sm font-semibold leading-tight">{t.title}</h4>
          <Button
            asChild
            size="sm"
            className="mt-4 w-full bg-gradient-brand text-xs font-bold uppercase tracking-wider text-primary-foreground transition-shadow duration-300 hover:opacity-90 group-hover:shadow-[0_0_20px_oklch(0.51_0.23_277_/_0.25)]"
          >
            <Link to="/register">Join Tournament</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function TrustCard({ t }: { t: (typeof trustStrip)[number] }) {
  const { ref, onMove, onLeave } = useSpotlight();
  const Icon = t.icon;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="premium-card group relative overflow-hidden rounded-xl"
    >
      {/* Gradient border */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-border/40 via-border/20 to-border/40 transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:from-primary/40 group-hover:via-primary/15 group-hover:to-primary/40" />

      {/* Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: "radial-gradient(300px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.07), transparent 60%)",
        }}
      />

      {/* Inner */}
      <div className="relative flex items-center gap-3 rounded-[11px] bg-background/50 p-4 backdrop-blur transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:bg-background/70">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 transition-all duration-300 group-hover:bg-primary/15 group-hover:shadow-[0_0_16px_oklch(0.51_0.23_277_/_0.15)]">
          <Icon className="h-5 w-5 text-primary-glow trust-icon-float" />
        </div>
        <div>
          <div className="text-sm font-semibold">{t.label}</div>
          <div className="text-[11px] text-muted-foreground">{t.sub}</div>
        </div>
      </div>
    </div>
  );
}

export function Stats() {
  return (
    <section className="relative border-y border-border/50 bg-surface/20">
      <div className="absolute inset-0 hex-pattern opacity-30" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        {/* Header */}
        <div className="text-center">
          <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">Trusted by competitors</p>
          <h2 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl md:text-6xl">
            Built for <span className="text-gradient-brand">Competition</span>
          </h2>
        </div>

        {/* Trending Tournaments */}
        <div className="mt-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-sm tracking-[0.2em] uppercase text-foreground">Trending Tournaments</h3>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              <Link to="/register">
                View all tournaments <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tournaments.map((t) => (
              <TournamentCard key={t.title} t={t} />
            ))}
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {trustStrip.map((t) => (
            <TrustCard key={t.label} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { useSpotlight } from "@/hooks/use-spotlight";
import { PremiumCard } from "@/components/ui/premium-card";
import { Status } from "@/components/ui/status";
import { IconTile } from "@/components/ui/icon-tile";
import {
  ShieldCheckIcon,
  BanknoteIcon,
  HeadsetIcon,
  SwordsIcon,
  type AnimatedIconHandle,
} from "@/components/ui/animated-icons";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
// NCAA finally has its own cover: EA Sports College Football 27, client-supplied.
// Until now this pointed at the Madden image because there was nothing else.
import cardNcaa from "@/assets/card-ncaa.jpg";
import cardMlb from "@/assets/card-mlbshow.jpg";

const tournaments = [
  { game: "Fortnite", title: "Fortnite Box Fight Showdown", img: cardFortnite },
  { game: "NBA 2K27", title: "NBA 2K27 Pro League", img: cardNba2k },
  { game: "Madden NFL 27", title: "Madden NFL 27 Championship Series", img: cardMadden },
  { game: "NCAA 27", title: "NCAA 27 Rivalry Cup", img: cardNcaa },
  { game: "MLB The Show 26", title: "MLB The Show 26 Diamond Series", img: cardMlb },
];

const trustStrip = [
  { icon: ShieldCheckIcon, label: "Fair Play", sub: "Every match verified" },
  { icon: BanknoteIcon, label: "Secure Payouts", sub: "Powered by Stripe" },
  { icon: HeadsetIcon, label: "24/7 Support", sub: "We've got your back" },
  { icon: SwordsIcon, label: "Compete & Win", sub: "Real cash prizes" },
];

function TournamentCard({ t }: { t: (typeof tournaments)[number] }) {
  return (
    <PremiumCard>
      <>
        {/* Image */}
        <div className="relative aspect-[16/9] overflow-hidden rounded-t-[11px]">
          <img
            src={t.img}
            alt={t.title}
            className="h-full w-full object-cover object-[center_30%] transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            width={640}
            height={360}
          />
          <div className="absolute inset-0 img-scrim" />
          <Status
            variant="brandSolid"
            className="absolute bottom-2 left-3 px-2 py-0.5 text-[10px] uppercase tracking-wider"
          >
            {t.game}
          </Status>
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
      </>
    </PremiumCard>
  );
}

function TrustCard({ t }: { t: (typeof trustStrip)[number] }) {
  const { ref, onMove, onLeave } = useSpotlight();
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = t.icon;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => {
        onLeave();
        iconRef.current?.stopAnimation();
      }}
      className="premium-card group relative overflow-hidden rounded-xl"
    >
      {/* Gradient border */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-border/40 via-border/20 to-border/40 transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:from-primary/40 group-hover:via-primary/15 group-hover:to-primary/40" />

      {/* Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(300px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.07), transparent 60%)",
        }}
      />

      {/* Inner */}
      <div className="relative flex items-center gap-3 rounded-[11px] bg-background/50 p-4 backdrop-blur transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:bg-background/70">
        <IconTile>
          <Icon ref={iconRef} size={20} />
        </IconTile>
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
          <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">
            Trusted by competitors
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl md:text-6xl">
            Built for <span className="text-gradient-brand">Competition</span>
          </h2>
        </div>

        {/* Trending Tournaments */}
        <div className="mt-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-display text-sm tracking-[0.2em] uppercase text-foreground">
                Trending Tournaments
              </h3>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
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

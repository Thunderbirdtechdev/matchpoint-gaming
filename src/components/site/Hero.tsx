import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Zap, Shield, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroBg from "@/assets/hero-bg.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          width={1920}
          height={1080}
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
        {/* Soft ambient glow */}
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-40 top-60 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-28 sm:px-6 md:pb-36 md:pt-36">
        <div className="mx-auto max-w-4xl text-center animate-fade-in">
          <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-accent backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Season 1 · Live Now
          </div>

          <h1 className="font-display text-balance text-6xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl md:text-8xl">
            <span className="block">Play. Compete.</span>
            <span className="mt-2 block text-gradient-brand">Win.</span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg md:text-xl">
            The skill-based arena for serious gamers. Throw down 1v1 challenges, drop into
            tournaments, climb the global ranks — and prove you've got the skills.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-gradient-brand px-7 text-sm font-bold uppercase tracking-wider text-primary-foreground glow-primary transition-all hover:scale-[1.02] hover:opacity-95"
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
              className="h-12 border-border/80 bg-surface/40 px-7 text-sm font-semibold uppercase tracking-wider backdrop-blur hover:bg-surface"
            >
              <Link to="/games">
                <Play className="mr-1 h-4 w-4" />
                Browse Games
              </Link>
            </Button>
          </div>

          {/* Pillars */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Swords, label: "1v1 Challenges", sub: "Instant matchmaking" },
              { icon: Shield, label: "Verified Matches", sub: "Anti-cheat enforced" },
              { icon: Zap, label: "Fast Payouts", sub: "Win it. Wallet it." },
            ].map((p) => (
              <div
                key={p.label}
                className="clip-corner border border-border/60 bg-gradient-card px-4 py-4 text-left backdrop-blur"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-primary/15 text-primary">
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-bold uppercase tracking-wider">
                      {p.label}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.sub}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

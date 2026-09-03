import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import fortnite from "@/assets/game-fortnite.jpg";
import madden from "@/assets/game-madden.jpg";
import nba from "@/assets/game-nba.jpg";
import mlb from "@/assets/game-mlb.jpg";

const games = [
  {
    slug: "fortnite",
    name: "Fortnite",
    img: fortnite,
    modes: "1v1 Build Fights, Box Fights, Zone Wars",
    platforms: "PC, PlayStation, Xbox, Switch",
  },
  {
    slug: "nba2k",
    name: "NBA 2K27",
    img: nba,
    modes: "1v1 Play Now, MyTeam, Head-to-Head",
    platforms: "PC, PlayStation, Xbox",
  },
  {
    slug: "madden",
    name: "Madden NFL 27",
    img: madden,
    modes: "1v1 Head-to-Head, MUT, Online Ranked",
    platforms: "PC, PlayStation, Xbox",
  },
  {
    slug: "ncaa",
    name: "NCAA 27",
    img: madden,
    modes: "1v1 Head-to-Head, Online Dynasty",
    platforms: "PlayStation, Xbox",
  },
  {
    slug: "mlbshow",
    name: "MLB The Show 26",
    img: mlb,
    modes: "1v1 Head-to-Head, Diamond Dynasty",
    platforms: "PlayStation, Xbox, Switch",
  },
];

export function Games() {
  return (
    <section id="games" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-display text-sm tracking-[0.28em] text-accent">Supported Titles</p>
          <h2 className="mt-3 font-display text-5xl tracking-wide sm:text-6xl">
            Five games. Real competition.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            We're launching with the titles that matter most — with 1v1 challenges and tournaments
            running around the clock.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {games.map((g) => (
            <article
              key={g.slug}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={g.img}
                  alt={g.name}
                  loading="lazy"
                  width={600}
                  height={800}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-display text-xl font-bold uppercase tracking-wider">
                  {g.name}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{g.modes}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/70">{g.platforms}</p>
              </div>

              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="absolute inset-0 ring-1 ring-inset ring-primary/40" />
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <InteractiveHoverButton
            asChild
            text="Start Competing"
            icon={<ArrowRight className="h-5 w-5" />}
            className="h-12 border-primary/50 px-8 font-display text-lg tracking-[0.12em]"
          >
            <Link to="/register" />
          </InteractiveHoverButton>
        </div>
      </div>
    </section>
  );
}

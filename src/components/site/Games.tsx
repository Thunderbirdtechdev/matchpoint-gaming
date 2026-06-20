import fortnite from "@/assets/game-fortnite.jpg";
import madden from "@/assets/game-madden.jpg";
import nba from "@/assets/game-nba.jpg";
import mlb from "@/assets/game-mlb.jpg";
import cod from "@/assets/game-cod.jpg";
import fc from "@/assets/game-fc.jpg";

const games = [
  { name: "Fortnite", img: fortnite, comps: 1240, tourneys: 32 },
  { name: "Madden NFL", img: madden, comps: 612, tourneys: 14 },
  { name: "NBA 2K", img: nba, comps: 884, tourneys: 21 },
  { name: "MLB The Show", img: mlb, comps: 308, tourneys: 9 },
  { name: "Call of Duty", img: cod, comps: 1502, tourneys: 41 },
  { name: "EA Sports FC", img: fc, comps: 970, tourneys: 23 },
];

export function Games() {
  return (
    <section id="games" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Supported Games</p>
          <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">
            Compete in the titles you love
          </h2>
          <p className="mt-4 text-muted-foreground">
            Six flagship games at launch — with live competitions and tournaments running 24/7.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <article
              key={g.name}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card shadow-card transition-all duration-500 hover:-translate-y-1 hover:shadow-elevated"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={g.img}
                  alt={g.name}
                  loading="lazy"
                  width={800}
                  height={1000}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
              </div>

              <div className="absolute inset-x-0 bottom-0 p-6">
                <h3 className="font-display text-2xl font-bold uppercase tracking-wider">{g.name}</h3>
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    <span className="font-semibold text-foreground">{g.comps.toLocaleString()}</span> active
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                    <span className="font-semibold text-foreground">{g.tourneys}</span> tournaments
                  </span>
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="absolute inset-0 ring-1 ring-inset ring-primary/40" />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

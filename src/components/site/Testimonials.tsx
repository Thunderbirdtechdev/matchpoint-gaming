import { Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "Finally a platform where I can actually cash out without getting jerked around. Payouts hit my wallet same day.",
    name: "Devon R.",
    handle: "@snipeking",
    game: "Call of Duty",
  },
  {
    quote:
      "The dispute team is legit. Submitted my clip, got my W within hours. No more arguing in DMs.",
    name: "Maya T.",
    handle: "@mayaballs",
    game: "NBA 2K",
  },
  {
    quote:
      "Ran my first tournament last month — 64 players, zero issues. The bracket tools are unreal.",
    name: "Andre P.",
    handle: "@droppin30",
    game: "Madden NFL",
  },
];

export function Testimonials() {
  return (
    <section className="relative border-y border-border/50 bg-surface/30 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            Player Stories
          </p>
          <h2 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl">
            From players who actually win
          </h2>
          <p className="mt-4 text-muted-foreground">
            Real reviews from the MatchPoint community.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.handle}
              className="group relative flex h-full flex-col rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-foreground/90">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.handle}</div>
                </div>
                <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t.game}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

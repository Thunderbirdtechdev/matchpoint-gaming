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
    <section className="relative border-y border-border/50 bg-surface/25 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-display text-sm tracking-[0.28em] text-accent">Player stories</p>
          <h2 className="mt-3 font-display text-5xl tracking-wide sm:text-6xl">
            From players who actually win
          </h2>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure key={t.handle} className="flex h-full flex-col border-t border-border/60 pt-6">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-foreground/90">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.handle}</div>
                </div>
                <span className="shrink-0 font-display text-xs tracking-[0.18em] text-muted-foreground">
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

import { Star } from "lucide-react";
import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";

const testimonials = [
  {
    quote:
      "Finally a platform where I can actually cash out without getting jerked around. Payouts hit my wallet same day.",
    name: "Devon R.",
    handle: "@buildbattle",
    game: "Fortnite",
    stars: 5,
  },
  {
    quote:
      "The dispute team is legit. Submitted my clip, got my W within hours. No more arguing in DMs.",
    name: "Maya T.",
    handle: "@mayaballs",
    game: "NBA 2K27",
    stars: 5,
  },
  {
    quote:
      "Ran my first tournament last month, 64 players, zero issues. The bracket tools are unreal.",
    name: "Andre P.",
    handle: "@droppin30",
    game: "Madden NFL 27",
    stars: 5,
  },
];

function TestimonialCard({
  t,
  index,
  visible,
}: {
  t: (typeof testimonials)[number];
  index: number;
  visible: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);

  const onMove = useCallback((e: MouseEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = (x / rect.width - 0.5) * 2;
    const cy = (y / rect.height - 0.5) * 2;
    el.style.setProperty("--spot-x", `${x}px`);
    el.style.setProperty("--spot-y", `${y}px`);
    el.style.setProperty("--tilt-x", `${cy * -3}deg`);
    el.style.setProperty("--tilt-y", `${cx * 5}deg`);
  }, []);

  const onLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return (
    <figure
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={`group relative flex h-full flex-col transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{
        transitionDelay: `${index * 150 + 200}ms`,
        perspective: "800px",
      }}
    >
      {/* Gradient border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-border/40 via-border/20 to-border/40 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:from-primary/50 group-hover:via-primary/20 group-hover:to-primary/50" />

      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(350px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.07), transparent 60%)",
        }}
      />

      {/* Inner card */}
      <div
        className="relative flex h-full flex-col rounded-[15px] bg-background/70 p-6 backdrop-blur transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-1"
        style={{
          transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        }}
      >
        {/* Stars */}
        <div className="flex gap-1">
          {Array.from({ length: t.stars }).map((_, i) => (
            <Star
              key={i}
              className="h-4 w-4 fill-accent text-accent transition-all duration-300"
              style={{
                animation: visible
                  ? `testimonial-star-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 150 + i * 80 + 500}ms both`
                  : "none",
              }}
            />
          ))}
        </div>

        <blockquote className="mt-5 flex-1 text-lg leading-relaxed text-foreground/90">
          &ldquo;{t.quote}&rdquo;
        </blockquote>

        <figcaption className="mt-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border/20 pt-5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{t.name}</div>
            <div className="truncate text-xs text-muted-foreground">{t.handle}</div>
          </div>
          <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 font-display text-[10px] tracking-[0.18em] uppercase text-primary">
            {t.game}
          </span>
        </figcaption>
      </div>
    </figure>
  );
}

export function Testimonials() {
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
    <section
      ref={sectionRef}
      className="relative border-y border-border/50 bg-surface/25 py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div
          className={`max-w-2xl transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">
            Player stories
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl md:text-6xl">
            From players who actually <span className="text-gradient-brand">win</span>
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <TestimonialCard key={t.handle} t={t} index={i} visible={visible} />
          ))}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";

const metrics = [
  { end: 128, suffix: "K+", prefix: "", label: "Registered Players" },
  { end: 892, suffix: "K", prefix: "", label: "Matches Played" },
  { end: 2.4, suffix: "M", prefix: "$", label: "Prize Money Distributed", decimals: 1 },
  { end: 317, suffix: "", prefix: "", label: "Tournaments Hosted" },
];

const DURATION = 2000;

function useCountUp(end: number, started: boolean, decimals = 0) {
  const [value, setValue] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(parseFloat((eased * end).toFixed(decimals)));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    }

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [started, end, decimals]);

  return { value, done };
}

function Metric({ end, suffix, prefix, label, decimals = 0, index }: {
  end: number; suffix: string; prefix: string; label: string; decimals?: number; index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { value: count, done } = useCountUp(end, visible, decimals);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setVisible(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center justify-center px-4 py-6 sm:py-8 transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 200}ms` }}
    >
      {/* Glow backdrop behind number */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full transition-opacity duration-1000"
        style={{
          background: "radial-gradient(circle, oklch(0.51 0.23 277 / 0.12) 0%, transparent 70%)",
          opacity: done ? 1 : 0,
        }}
      />

      {/* Number */}
      <span
        className="relative font-display text-5xl tracking-wide text-foreground sm:text-6xl md:text-7xl"
        style={{
          animation: done
            ? `stat-count-land 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both, stat-glow-pulse 3s ease-in-out 0.5s infinite`
            : "none",
          // Tokenised: this is clipped to the text, and the dark-mode ramp runs
          // near-white -> light indigo -> near-white, which on a white page is
          // very nearly invisible. `--gradient-stat` inverts it for light.
          backgroundImage: done ? "var(--gradient-stat)" : "none",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: done ? "text" : "unset",
          backgroundClip: done ? "text" : "unset",
          WebkitTextFillColor: done ? "transparent" : "unset",
          ...(done ? { animation: `stat-count-land 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both, stat-shimmer 3s linear 1s infinite, stat-glow-pulse 4s ease-in-out 1s infinite` } : {}),
        }}
      >
        {prefix}{decimals > 0 ? count.toFixed(decimals) : count}{suffix}
      </span>

      {/* Label */}
      <span
        className="relative mt-3 text-sm tracking-[0.15em] uppercase text-muted-foreground"
        style={{
          animation: visible
            ? `stat-label-reveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${index * 200 + 400}ms both`
            : "none",
        }}
      >
        {label}
      </span>

      {/* Animated right divider */}
      {index < metrics.length - 1 && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 max-lg:hidden"
          style={{
            background: "linear-gradient(to bottom, transparent, oklch(0.51 0.23 277 / 0.5), transparent)",
            animation: visible
              ? `stat-divider-glow 3s ease-in-out ${index * 200 + 600}ms infinite`
              : "none",
            opacity: visible ? undefined : 0,
          }}
        />
      )}

      {/* Mobile bottom divider for first two items */}
      {index < 2 && (
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3/4 lg:hidden"
          style={{
            background: "linear-gradient(to right, transparent, oklch(0.51 0.23 277 / 0.5), transparent)",
            animation: visible
              ? `stat-divider-glow 3s ease-in-out ${index * 200 + 600}ms infinite`
              : "none",
            opacity: visible ? undefined : 0,
          }}
        />
      )}
    </div>
  );
}

export function PlatformStats() {
  return (
    <section className="relative overflow-hidden border-y border-border/30 bg-background">
      {/* Subtle grid background */}
      <div className="absolute inset-0 grid-pattern opacity-20" />

      {/* Soft top/bottom glow accents */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((m, i) => (
            <Metric key={m.label} {...m} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

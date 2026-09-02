import { type ReactNode, useState, useEffect } from "react";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  image,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
  image?: { src: string; alt: string };
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [image]);

  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <BackgroundPattern />
      <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className={`relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 ${image ? "grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14" : ""}`}>
        <div>
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-3 max-w-3xl text-balance font-display text-4xl font-black uppercase tracking-tight sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-2xl text-balance text-muted-foreground sm:text-lg">
              {description}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </div>

        {image && (
          <div
            className={`relative hidden lg:block transition-all duration-1000 ${
              visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
            }`}
          >
            {/* Ambient glow */}
            <div className="absolute -inset-8 rounded-3xl bg-primary/10 blur-3xl page-header-glow" />

            {/* Glowing border */}
            <div
              className="absolute -inset-px rounded-2xl page-header-border-glow"
              style={{
                background: "linear-gradient(135deg, oklch(0.6 0.15 277 / 0.5) 0%, oklch(0.4 0.08 280 / 0.1) 30%, oklch(0.5 0.12 290 / 0.15) 60%, oklch(0.6 0.15 277 / 0.4) 100%)",
              }}
            />

            <div className="relative overflow-hidden rounded-2xl bg-background">
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="h-full w-full object-cover page-header-ken-burns"
                  width={640}
                  height={480}
                  loading="eager"
                />
              </div>

              {/* Overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/20 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/30" />

              {/* Live badge */}
              <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live Competitions
              </div>

              {/* Bottom badges */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-1.5 text-[11px] font-bold text-accent backdrop-blur-sm">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.85c0 1.89-1.44 2.96-3.12 3.19z" />
                    </svg>
                    Real Cash Prizes
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur-sm">
                    4 Games Live
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

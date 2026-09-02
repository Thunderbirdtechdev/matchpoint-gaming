import { type ReactNode, useState, useEffect } from "react";
import { Coins, Gamepad2 } from "lucide-react";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";
import { Status, StatusIndicator, StatusLabel } from "@/components/ui/status";

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
      <div
        className={`relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 ${image ? "grid items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14" : ""}`}
      >
        <div>
          {eyebrow && (
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">{eyebrow}</p>
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
                background:
                  "linear-gradient(135deg, oklch(0.6 0.15 277 / 0.5) 0%, oklch(0.4 0.08 280 / 0.1) 30%, oklch(0.5 0.12 290 / 0.15) 60%, oklch(0.6 0.15 277 / 0.4) 100%)",
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
              <Status variant="live" className="absolute left-4 top-4">
                <StatusIndicator />
                <StatusLabel>Live Competitions</StatusLabel>
              </Status>

              {/* Bottom badges */}
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-5">
                <Status variant="prize">
                  <Coins aria-hidden="true" />
                  <StatusLabel>Real Cash Prizes</StatusLabel>
                </Status>
                <Status variant="glass">
                  <Gamepad2 aria-hidden="true" />
                  <StatusLabel>4 Games Live</StatusLabel>
                </Status>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

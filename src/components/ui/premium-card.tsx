import { type ReactNode } from "react";
import { useSpotlight } from "@/hooks/use-spotlight";
import { cn } from "@/lib/utils";

/**
 * The site's premium card shell: gradient border that warms to brand on hover,
 * a cursor-tracked spotlight, and an inner surface that lifts and tilts.
 * The border lifts with the inner card so no glow strip is exposed underneath.
 */
export function PremiumCard({
  children,
  className,
  innerClassName,
  spotlightRadius = 400,
}: {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  spotlightRadius?: number;
}) {
  const { ref, onMove, onLeave } = useSpotlight();

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "group relative overflow-hidden rounded-xl bg-background/60 backdrop-blur",
        className,
      )}
      style={{ perspective: "800px" }}
    >
      {/* Gradient border layer — lifts with the inner card */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-border/50 via-border/30 to-border/50 transition-all duration-300 ease-out group-hover:-translate-y-1 group-hover:from-primary/50 group-hover:via-primary/20 group-hover:to-primary/50" />

      {/* Spotlight overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${spotlightRadius}px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.08), transparent 60%)`,
        }}
      />

      {/* Inner surface */}
      <div
        className={cn(
          "relative flex h-full flex-col rounded-[11px] bg-background/80 transition-transform duration-300 ease-out will-change-transform group-hover:-translate-y-1",
          innerClassName,
        )}
        style={{ transform: "rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))" }}
      >
        {children}
      </div>
    </div>
  );
}

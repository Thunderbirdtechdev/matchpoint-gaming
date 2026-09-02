import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The rounded tile an icon sits in.
 *
 * Every one of these across the site used to be an ad-hoc translucent wash
 * (`bg-primary/10`, `bg-surface/80`, …). At 10–20% alpha over a dark page the
 * tile has no body — it reads as a smudge behind the glyph rather than a
 * deliberate surface. So this fills SOLID: a top-lit gradient between two real
 * surface colours, a hairline inset ring, and a 1px inner highlight along the
 * top edge, the way a physical raised chip catches light.
 *
 * Put it inside a `group` and it warms to brand on hover.
 */
const iconTileVariants = cva(
  [
    "relative grid shrink-0 place-items-center",
    "bg-gradient-to-b from-[oklch(0.27_0.062_285)] to-[oklch(0.195_0.048_285)]",
    "text-primary-glow",
    "ring-1 ring-inset ring-white/10",
    "shadow-[inset_0_1px_0_oklch(1_0_0/0.07)]",
    "transition-all duration-300 ease-out",
    "group-hover:from-[oklch(0.32_0.09_283)] group-hover:to-[oklch(0.22_0.06_285)]",
    "group-hover:ring-primary/50",
    "group-hover:shadow-[inset_0_1px_0_oklch(1_0_0/0.14),0_0_22px_oklch(0.51_0.23_277/0.30)]",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "h-10 w-10 rounded-lg",
        md: "h-11 w-11 rounded-xl",
        lg: "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface IconTileProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof iconTileVariants> {}

export function IconTile({ className, size, children, ...props }: IconTileProps) {
  return (
    <div className={cn(iconTileVariants({ size }), className)} {...props}>
      {children}
    </div>
  );
}

export { iconTileVariants };

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill-shaped status badge with an optional pulsing indicator dot.
 * Based on the 21st.dev "Status" component (@diceui), extended with the
 * project's brand palette and a set of `overlay` variants tuned for sitting
 * on top of imagery — those add a dark glass backing so they stay legible
 * over any photo.
 */
const statusVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-muted text-muted-foreground **:data-[slot=status-indicator]:bg-muted-foreground",
        brand:
          "border-primary/30 bg-primary/15 text-primary-glow **:data-[slot=status-indicator]:bg-primary-glow",
        accent:
          "border-accent/30 bg-accent/15 text-accent **:data-[slot=status-indicator]:bg-accent",
        success:
          "border-green-500/20 bg-green-500/10 text-green-400 **:data-[slot=status-indicator]:bg-green-400",
        error:
          "border-destructive/20 bg-destructive/10 text-destructive **:data-[slot=status-indicator]:bg-destructive",
        warning:
          "border-orange-500/20 bg-orange-500/10 text-orange-400 **:data-[slot=status-indicator]:bg-orange-400",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-400 **:data-[slot=status-indicator]:bg-blue-400",

        /*
         * On-image overlay variants. These sit on photography, so they use SOLID
         * fills rather than a tint of their own hue — a translucent same-hue wash
         * (e.g. gold text on 20% gold) muddies against the image and reads unfinished.
         */
        live: "border-white/10 bg-black/80 text-white **:data-[slot=status-indicator]:bg-green-400",
        prize:
          "border-transparent bg-accent font-bold text-accent-foreground shadow-[0_2px_10px_oklch(0.84_0.16_88_/_0.35)] **:data-[slot=status-indicator]:bg-accent-foreground",
        glass: "border-white/10 bg-black/80 text-white **:data-[slot=status-indicator]:bg-white/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StatusProps extends VariantProps<typeof statusVariants>, React.ComponentProps<"div"> {
  asChild?: boolean;
}

function Status(props: StatusProps) {
  const { className, variant = "default", asChild, ...rootProps } = props;
  const RootPrimitive = asChild ? Slot : "div";

  return (
    <RootPrimitive
      data-slot="status"
      data-variant={variant}
      {...rootProps}
      className={cn(statusVariants({ variant }), className)}
    />
  );
}

function StatusIndicator(props: React.ComponentProps<"div">) {
  const { className, ...indicatorProps } = props;

  return (
    <div
      data-slot="status-indicator"
      {...indicatorProps}
      className={cn(
        "relative flex size-2 shrink-0 rounded-full",
        "before:absolute before:inset-0 before:animate-ping before:rounded-full before:bg-inherit",
        "after:absolute after:inset-[2px] after:rounded-full after:bg-inherit",
        className,
      )}
    />
  );
}

function StatusLabel(props: React.ComponentProps<"div">) {
  const { className, ...labelProps } = props;

  return <div data-slot="status-label" {...labelProps} className={cn("leading-none", className)} />;
}

export { Status, StatusIndicator, StatusLabel, statusVariants };

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface InteractiveHoverButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text?: string;
  icon?: React.ReactNode;
  /** Render as the single child element (e.g. a router Link) instead of a <button>. */
  asChild?: boolean;
  /** Background of the fill that scales up. Override on brand-coloured sections,
   *  where the default `bg-primary` would be invisible against the backdrop. */
  fillClassName?: string;
  /** Text colour of the label that rides in over the fill. Pair with `fillClassName`. */
  fillTextClassName?: string;
}

/**
 * CTA button whose label slides out to the right as a labelled+iconed copy
 * slides in behind it, over a brand fill that scales up from the centre.
 *
 * Uses a NAMED group (`group/ihb`). A bare `group` would also match an ancestor
 * `.group` — a card, say — so hovering anywhere on the card would fire the
 * button's animation.
 *
 * Width is driven by the label plus `px-6`; that padding is what leaves room for
 * the icon in the incoming layer, so keep it if you override the sizing.
 */
const InteractiveHoverButton = React.forwardRef<HTMLButtonElement, InteractiveHoverButtonProps>(
  (
    {
      text = "Button",
      icon,
      className,
      asChild = false,
      fillClassName = "bg-primary",
      fillTextClassName = "text-primary-foreground",
      children,
      ...props
    },
    ref,
  ) => {
    const content = (
      <>
        <span className="inline-block transition-all duration-300 group-hover/ihb:translate-x-[200%] group-hover/ihb:opacity-0">
          {text}
        </span>
        <span
          className={cn(
            "absolute inset-0 z-10 flex translate-x-[200%] items-center justify-center gap-2 opacity-0 transition-all duration-300 group-hover/ihb:translate-x-0 group-hover/ihb:opacity-100",
            fillTextClassName,
          )}
        >
          <span>{text}</span>
          {icon ?? <ArrowRight className="h-4 w-4" />}
        </span>
        <span
          className={cn(
            "absolute inset-0 scale-0 rounded-[inherit] opacity-0 transition-all duration-300 group-hover/ihb:scale-100 group-hover/ihb:opacity-100",
            fillClassName,
          )}
        />
      </>
    );

    const classes = cn(
      "group/ihb relative inline-flex cursor-pointer items-center justify-center overflow-hidden",
      "rounded-full border border-border bg-background px-6 py-2 text-center font-semibold",
      className,
    );

    if (asChild) {
      const child = React.Children.only(children) as React.ReactElement;
      return (
        <Slot ref={ref} className={classes} {...props}>
          {React.cloneElement(child, undefined, content)}
        </Slot>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {content}
      </button>
    );
  },
);

InteractiveHoverButton.displayName = "InteractiveHoverButton";

export { InteractiveHoverButton };

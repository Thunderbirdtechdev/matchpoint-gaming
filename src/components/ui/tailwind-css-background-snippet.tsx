import { cn } from "@/lib/utils";

/**
 * Full-bleed radial-gradient backdrop.
 * Drop it as the first child of any `relative` container; keep sibling content
 * in a `relative z-10` wrapper so it renders above the gradient.
 *
 * ⚠️ The gradient is the `--gradient-page` token, NOT a hardcoded colour.
 *
 * It used to be an arbitrary Tailwind value, `#000 -> #63e`. This component
 * backs the hero, every page header and all the auth screens, so that one
 * hardcoded black meant light mode rendered dark headlines on a black hero
 * across most of the site while the rest of the page turned white.
 */
export const BackgroundPattern = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 [background:var(--gradient-page)]",
        className,
      )}
    />
  );
};

export const Hero = () => {
  return (
    <div className={cn("w-full relative h-screen")}>
      {/* Background Pattern */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 -z-10 h-full w-full items-center px-5 py-24 [background:var(--gradient-page)]"></div>
      </div>
    </div>
  );
};

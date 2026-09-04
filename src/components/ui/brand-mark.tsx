/**
 * The MatchPoint mark — the crossed-swords crest, in one place.
 *
 * Before this, the navbar used the real logo while the dashboard sidebar, the
 * footer and all four auth pages drew a lucide `Trophy` glyph inside a purple
 * gradient tile. That was a stand-in nobody replaced, so the brand a signed-in
 * player saw was not the brand on the marketing site — and the client noticed.
 *
 * The asset is a transparent PNG, so it needs no tile behind it. Wrapping it in
 * `bg-gradient-brand` (as the trophy versions did) would put the logo's own
 * blue-violet gradient on top of another one and muddy both.
 */

import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  /** Rendered px. Also sets width/height so the image reserves space before it loads. */
  size?: number;
}) {
  return (
    <img
      src={logo}
      alt="MatchPoint Gaming"
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}

/** The mark plus the wordmark, as used in headers and on the auth pages. */
export function BrandLockup({
  className,
  size = 36,
  textClassName,
}: {
  className?: string;
  size?: number;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <BrandMark size={size} />
      <span className={cn("text-xl font-bold", textClassName)}>
        Match<span className="text-gradient-brand">Point</span>
      </span>
    </span>
  );
}

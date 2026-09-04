/**
 * The frame around sign in, sign up and the two password screens.
 *
 * All four used to be a lone card floating in the middle of an empty gradient —
 * functional, and the least convincing page on a site that asks people to put
 * real money into it. This adds a second column that does the job the card
 * cannot: it says what the platform is and why handing it your money is safe,
 * at the exact moment someone is deciding whether to.
 *
 * Composed entirely from what already exists — BackgroundPattern, IconTile,
 * Status, the brand tokens — so it reads as the same product as the marketing
 * site rather than a separate login app.
 *
 * The left column is `hidden lg:flex`. On a phone the form is the whole job and
 * a value-proposition panel above it just pushes the fields off the screen.
 */

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Zap, Lock } from "lucide-react";

import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";
import { BrandLockup } from "@/components/ui/brand-mark";
import { IconTile } from "@/components/ui/icon-tile";

const POINTS = [
  {
    icon: Lock,
    title: "Escrow-protected",
    body: "Entry fees are held until the match is verified. Nobody touches funds early.",
  },
  {
    icon: ShieldCheck,
    title: "Every match verified",
    body: "Both players confirm the result. Disputes go to a real review team.",
  },
  {
    icon: Zap,
    title: "Cash out to your bank",
    body: "Standard withdrawals are free. Same-day lands in hours.",
  },
];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The "already have an account?" line under the card. */
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <BackgroundPattern />

      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-4 py-12 sm:px-6">
        <div className="grid w-full gap-12 lg:grid-cols-[1.05fr_minmax(0,26rem)] lg:gap-16">
          {/* ── Pitch column ── */}
          <div className="hidden flex-col justify-center lg:flex">
            <Link to="/" className="inline-flex w-fit">
              <BrandLockup size={44} textClassName="text-2xl" />
            </Link>

            <h2 className="mt-10 font-display text-4xl leading-[1.1] tracking-tight xl:text-5xl">
              Real matches.
              <br />
              Real money.
              <br />
              <span className="text-gradient-brand">Real stakes.</span>
            </h2>

            <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
              Challenge anyone to a 1v1 in Fortnite, NBA 2K27, Madden NFL 27, NCAA 27 or MLB The
              Show 26 — then put your skills where your money is.
            </p>

            <ul className="mt-10 space-y-5">
              {POINTS.map((p) => (
                <li key={p.title} className="group flex gap-4">
                  <IconTile size="md">
                    <p.icon className="h-5 w-5" />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{p.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Form column ── */}
          <div className="mx-auto w-full max-w-md lg:mx-0">
            {/* The lockup repeats here for mobile, where the pitch column is hidden
                and the page would otherwise open with no branding at all. */}
            <Link to="/" className="mx-auto mb-8 flex w-fit lg:hidden">
              <BrandLockup />
            </Link>

            <div className="rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-elevated">
              <h1 className="font-display text-2xl tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}

              <div className="mt-7">{children}</div>

              {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              . You must be 18+ to compete for money.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

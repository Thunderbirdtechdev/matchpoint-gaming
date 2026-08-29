import { Check, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const tiers = [
  { pool: "$1 – $25", rate: "10%", example: "$10 entry = $18 winner payout" },
  { pool: "$26 – $100", rate: "8%", example: "$25 entry = $46 winner payout" },
  { pool: "$101 – $500", rate: "6%", example: "$100 entry = $188 winner payout" },
  { pool: "$501+", rate: "5%", example: "$500 entry = $950 winner payout" },
];

const perks = [
  "No monthly subscription required",
  "Free standard withdrawals (2-5 days)",
  "Same-day cash out available",
  "No hidden charges or surcharges",
  "Fee only applied when a match settles",
  "$10 minimum entry per competition",
];

export function Pricing() {
  return (
    <section id="pricing" className="relative overflow-hidden border-y border-border/50 bg-background py-20 md:py-28">
      {/* Subtle particle dots */}
      <div className="absolute inset-0 grid-pattern opacity-8" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Centered header */}
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold uppercase tracking-wide sm:text-5xl md:text-6xl lg:text-7xl">
            Transparent Fees. No Surprises.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base italic text-muted-foreground">
            MatchPoint takes a small percentage of the prize pool when a match
            settles. Bigger pools get lower rates.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="mt-16 grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          {/* Fee table card */}
          <div className="relative">
            {/* Border glow — brighter at top */}
            <div
              className="absolute -inset-px rounded-2xl"
              style={{
                background: "linear-gradient(180deg, oklch(0.65 0.15 277 / 0.5) 0%, oklch(0.5 0.1 277 / 0.2) 30%, oklch(0.4 0.08 280 / 0.15) 100%)",
              }}
            />
            {/* Soft top glow */}
            <div
              className="absolute -top-6 left-1/2 -translate-x-1/2 h-12 w-3/4 rounded-full blur-2xl"
              style={{ background: "oklch(0.55 0.18 277 / 0.12)" }}
            />

            <div className="relative overflow-hidden rounded-2xl bg-background">
              {/* Table header */}
              <div className="grid grid-cols-3 gap-4 border-b border-border/30 px-6 py-4">
                <span className="font-display text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Pool Size</span>
                <span className="font-display text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Platform Fee</span>
                <span className="font-display text-[11px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">Example (1v1)</span>
              </div>

              {/* Table rows */}
              {tiers.map((t, i) => (
                <div
                  key={t.pool}
                  className={`grid grid-cols-3 items-center gap-4 px-6 py-5 ${
                    i < tiers.length - 1 ? "border-b border-border/15" : ""
                  }`}
                >
                  <span className="text-[15px] font-medium text-foreground">{t.pool}</span>
                  <span className="font-display text-3xl font-bold tracking-wide text-foreground">{t.rate}</span>
                  <span className="text-[13px] text-muted-foreground">{t.example}</span>
                </div>
              ))}
            </div>
          </div>

          {/* What you get + CTA */}
          <div className="flex flex-col justify-center">
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide sm:text-3xl">
              What You Get
            </h3>

            <ul className="mt-7 space-y-5">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3.5 text-[15px]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  </div>
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className="mt-10 flex h-14 w-full items-center justify-between rounded-xl bg-gradient-brand px-6 font-display text-base uppercase tracking-[0.15em] text-primary-foreground shadow-lg transition-all duration-300 hover:opacity-90 hover:shadow-[0_0_30px_oklch(0.51_0.23_277_/_0.3)] sm:text-lg"
            >
              <span>Create Free Account</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* MatchPoint branding bottom right */}
        <div className="mt-10 flex items-center justify-end gap-2 text-muted-foreground/40">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
            <path d="M3 3l9 18L21 3H3zm4.5 2h9L12 14.5 7.5 5z" />
          </svg>
          <span className="font-display text-xs tracking-[0.15em] uppercase">MatchPoint</span>
        </div>
      </div>
    </section>
  );
}

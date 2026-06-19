import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";

const tiers = [
  {
    name: "Rookie",
    price: "Free",
    desc: "Everything you need to start competing.",
    features: ["Unlimited public challenges", "Tournament registration", "Basic leaderboards", "Standard payouts (48h)"],
    cta: "Create Account",
    to: "/register",
  },
  {
    name: "Pro",
    price: "$9",
    suffix: "/mo",
    desc: "For competitive players chasing the leaderboard.",
    features: ["Everything in Rookie", "Private challenges", "Priority dispute review", "Instant payouts", "Pro profile badge"],
    cta: "Go Pro",
    to: "/register",
    highlight: true,
  },
  {
    name: "Organization",
    price: "Custom",
    desc: "Host your own tournaments and leagues.",
    features: ["Custom branded events", "Bracket automation", "Dedicated moderator", "Revenue share", "API access"],
    cta: "Contact Sales",
    to: "/host",
  },
];

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MatchPoint" },
      { name: "description", content: "Start free. Upgrade for instant payouts, private challenges and priority dispute review." },
      { property: "og:title", content: "Pricing — MatchPoint" },
      { property: "og:description", content: "Simple pricing for competitive players and organizations." },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Pricing"
        title={<>Free to play. <span className="text-gradient-gold">Built to win.</span></>}
        description="No platform fees on prize winnings. Upgrade for instant payouts and pro tooling."
      />

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-card p-8 shadow-card transition-all hover:-translate-y-1 ${
                t.highlight ? "border-primary/60 shadow-elevated glow-primary" : "border-border/60"
              }`}
            >
              {t.highlight && (
                <div className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight">{t.price}</span>
                {t.suffix && <span className="text-muted-foreground">{t.suffix}</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`mt-8 w-full ${
                  t.highlight ? "bg-gradient-brand text-primary-foreground hover:opacity-90" : ""
                }`}
                variant={t.highlight ? "default" : "outline"}
              >
                <Link to={t.to}>{t.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

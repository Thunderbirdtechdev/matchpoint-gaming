import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Trophy,
  Megaphone,
  Handshake,
  BadgeCheck,
  Users,
  Palette,
  Code2,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const hostingTiers = [
  {
    name: "Community",
    price: "$49",
    desc: "Perfect for friend groups and small communities.",
    features: [
      "Up to 64 players",
      "Single & double elimination",
      "Community listing",
      "Basic bracket automation",
      "Standard support",
    ],
    cta: "Get Started",
  },
  {
    name: "Featured",
    price: "$149",
    desc: "Boost visibility with homepage and category exposure.",
    features: [
      "Up to 256 players",
      "All bracket formats",
      "Featured tournament listing",
      "Homepage placement (1 week)",
      "Priority support",
    ],
    cta: "Go Featured",
    highlight: true,
  },
  {
    name: "Premium",
    price: "$299",
    suffix: "+",
    desc: "Maximum exposure for large-scale competitive events.",
    features: [
      "Unlimited players",
      "All bracket formats",
      "Platform spotlight (1 week)",
      "Dedicated moderator",
      "Custom branding",
    ],
    cta: "Contact Sales",
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "White-glove service for leagues, orgs, and brands.",
    features: [
      "Unlimited everything",
      "Custom integrations",
      "White-label options",
      "Dedicated account manager",
      "Revenue share negotiation",
    ],
    cta: "Contact Sales",
  },
];

const placements = [
  { name: "Featured Tournament Listing", price: "$25", period: "/week", desc: "Priority placement in the tournament browse page." },
  { name: "Homepage Placement", price: "$75", period: "/week", desc: "Prime real estate on the MatchPoint homepage." },
  { name: "Platform Spotlight", price: "$149", period: "/week", desc: "Full-platform spotlight with push notifications." },
];

const monetization = [
  {
    icon: Handshake,
    title: "Creator Tournaments",
    desc: "Host as a creator and earn 70% of tournament revenue. MatchPoint handles brackets, verification, and payouts.",
  },
  {
    icon: Megaphone,
    title: "Advertising & Sponsorships",
    desc: "Homepage banners, tournament sponsorships, sidebar placements, and branded content campaigns for gaming brands.",
  },
  {
    icon: BadgeCheck,
    title: "Verified Player Badges",
    price: "$4.99 one-time",
    desc: "Get a verified checkmark, enhanced trust score, and priority support — building credibility in every match.",
  },
  {
    icon: Users,
    title: "Team & Clan Pages",
    items: [
      { label: "Official Team Page", price: "$29" },
      { label: "Custom Branding Package", price: "$99" },
      { label: "Recruitment Listings", price: "$19" },
    ],
    desc: "Build your org's presence with custom pages, branding, and recruitment tools.",
  },
  {
    icon: Palette,
    title: "Premium Profile Customization",
    items: [
      { label: "Animated Profile Frames", price: "$4.99" },
      { label: "Custom Badges", price: "$2.99" },
      { label: "Profile Themes", price: "$4.99" },
      { label: "Username Changes", price: "$4.99" },
    ],
    desc: "Stand out with animated frames, custom badges, profile themes, and more.",
  },
  {
    icon: Code2,
    title: "API & White-Label Licensing",
    price: "Custom pricing",
    desc: "Future offering: License MatchPoint's tournament engine for your own community platform or esports organization.",
  },
];

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host a Tournament — MatchPoint" },
      { name: "description", content: "Host esports tournaments on MatchPoint. Community, featured, premium, and enterprise packages available. Contact sales for custom events." },
      { property: "og:title", content: "Host a Tournament — MatchPoint" },
      { property: "og:description", content: "From community brackets to enterprise leagues — host your next tournament on MatchPoint." },
    ],
  }),
  component: HostPage,
});

function HostPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Tournament Hosting"
        title={<>Host. Promote. <span className="text-gradient-gold">Grow.</span></>}
        description="From community brackets to enterprise leagues — bring your tournament to the biggest stage in competitive gaming."
      />

      {/* Hosting Tiers */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {hostingTiers.map((t) => (
            <div
              key={t.name}
              className={`relative overflow-hidden rounded-2xl border bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1 ${
                t.highlight
                  ? "border-primary/60 shadow-elevated glow-primary"
                  : "border-border/60"
              }`}
            >
              {t.highlight && (
                <div className="absolute right-3 top-3 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Popular
                </div>
              )}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{t.price}</span>
                {t.suffix && <span className="text-muted-foreground">{t.suffix}</span>}
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                className={`mt-6 w-full ${
                  t.highlight
                    ? "bg-gradient-brand text-primary-foreground hover:opacity-90"
                    : ""
                }`}
                variant={t.highlight ? "default" : "outline"}
              >
                <Link to={t.cta === "Contact Sales" ? "#contact-sales" : "/register"}>
                  {t.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Placements */}
      <section className="border-y border-border/50 bg-surface/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Featured <span className="text-gradient-brand">Placements</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Supercharge visibility with premium placement across the platform.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {placements.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1"
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gradient-gold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <h3 className="mt-3 font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Monetization & Revenue Share */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            More Ways to <span className="text-gradient-gold">Monetize</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Build your brand, grow your audience, and unlock new revenue streams.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {monetization.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <m.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{m.title}</h3>
              {m.price && (
                <p className="mt-1 text-sm font-medium text-accent">{m.price}</p>
              )}
              {m.items && (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {m.items.map((item) => (
                    <li key={item.label} className="flex items-center justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="font-medium text-foreground">{item.price}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact Sales Form */}
      <section id="contact-sales" className="border-t border-border/50 bg-surface/30 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Ready to host? <span className="text-gradient-brand">Let's talk.</span>
            </h2>
            <p className="mt-3 text-muted-foreground">
              Tell us about your event and we'll help you choose the right package — or build something completely custom.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { title: "Fast Setup", desc: "Tournaments go live in under 10 minutes." },
                { title: "Built-in Payouts", desc: "Automated prize distribution to winners." },
                { title: "Dispute Protection", desc: "Evidence-based review system built in." },
                { title: "Creator Friendly", desc: "Streamers & orgs keep 70% of revenue." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form className="mt-10 space-y-5 rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-card lg:mt-0">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="host-name">Name</Label>
                <Input id="host-name" placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="host-email">Email</Label>
                <Input id="host-email" type="email" placeholder="you@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="host-org">Organization</Label>
              <Input id="host-org" placeholder="Team, clan, or brand name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="host-package">Interested Package</Label>
              <Input id="host-package" placeholder="Community, Featured, Premium, Enterprise, or Custom" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="host-message">Tell us about your event</Label>
              <Textarea id="host-message" rows={4} placeholder="Game, format, expected players, dates..." />
            </div>
            <Button className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
              Send Inquiry
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-10 shadow-elevated md:p-16">
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-secondary/30 blur-3xl" />
          <div className="relative">
            <Trophy className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight sm:text-4xl">
              The next big tournament <span className="text-gradient-gold">starts with you</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Thousands of players are waiting. Host your first event today and build something legendary.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-95" asChild>
                <Link to="/register">
                  Create Free Account
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/80 bg-surface/40 hover:bg-surface" asChild>
                <Link to="/tournaments">Browse Tournaments</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}

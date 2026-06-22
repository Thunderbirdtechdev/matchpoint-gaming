import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MatchPoint" },
      { name: "description", content: "MatchPoint Terms of Service — eligibility, fair play rules, payouts, dispute resolution and account policies." },
      { property: "og:title", content: "Terms of Service — MatchPoint" },
      { property: "og:description", content: "Account, fair play, payout and dispute terms for MatchPoint players." },
      { property: "og:url", content: "https://matchpointgaming.org/terms" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/terms" }],
  }),
  component: () => (
    <SiteShell>
      <PageHeader eyebrow="Legal" title="Terms of Service" description="Last updated June 2026." />
      <section className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-sm leading-relaxed text-muted-foreground sm:px-6">
        <p>Welcome to MatchPoint. By creating an account or competing on the platform, you agree to these Terms.</p>
        <h2 className="text-base font-semibold text-foreground">1. Eligibility</h2>
        <p>You must be 13 years or older to use MatchPoint. Some regions require additional age verification for paid competitions.</p>
        <h2 className="text-base font-semibold text-foreground">2. Fair Play</h2>
        <p>Cheating, smurfing, account sharing and result manipulation are prohibited and may result in suspension or permanent ban.</p>
        <h2 className="text-base font-semibold text-foreground">3. Payouts</h2>
        <p>Winnings are credited to your wallet once both players confirm the result, or after moderator review for disputed matches.</p>
        <h2 className="text-base font-semibold text-foreground">4. Disputes</h2>
        <p>Disputes are resolved by our trained moderation team based on submitted evidence. Decisions are final but may be appealed once per match.</p>
      </section>
    </SiteShell>
  ),
});

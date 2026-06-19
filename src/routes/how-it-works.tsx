import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MatchPoint Works" },
      { name: "description", content: "Sign up, join a challenge or tournament, play, submit results and get paid — in five steps." },
      { property: "og:title", content: "How MatchPoint Works" },
      { property: "og:description", content: "From signup to payout in 5 steps." },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageHeader
        eyebrow="How it works"
        title={<>From signup to payout in <span className="text-gradient-brand">5 steps</span></>}
        description="MatchPoint takes care of matchmaking, evidence review, payouts and disputes so you can focus on the game."
      />
      <HowItWorks />
      <Features />
      <CTA />
    </SiteShell>
  ),
});

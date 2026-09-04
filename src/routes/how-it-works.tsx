import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How MatchPoint Works" },
      { name: "description", content: "Sign up, join a challenge or tournament, play, submit results and get paid, in five steps." },
      { property: "og:title", content: "How MatchPoint Works" },
      { property: "og:description", content: "From signup to payout in 5 steps." },
      { property: "og:url", content: "https://matchpointgaming.org/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/how-it-works" }],
  }),
  component: () => (
    <SiteShell>
      <HowItWorks />
      <Features />
      <CTA />
    </SiteShell>
  ),
});

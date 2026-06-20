import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { Hero } from "@/components/site/Hero";
import { Stats } from "@/components/site/Stats";
import { Games } from "@/components/site/Games";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchPoint — Play. Compete. Win." },
      {
        name: "description",
        content:
          "Skill-based competitive gaming platform. Create challenges, join tournaments, climb leaderboards and earn rewards across Fortnite, Madden, NBA 2K, MLB The Show, Call of Duty and EA Sports FC.",
      },
      { property: "og:title", content: "MatchPoint — Play. Compete. Win." },
      {
        property: "og:description",
        content: "Challenge players, enter tournaments, and prove your skills on MatchPoint.",
      },
    ],
  }),
  component: () => (
    <SiteShell>
      <Hero />
      <div className="animate-fade-in [animation-delay:100ms] [animation-fill-mode:both]">
        <Stats />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <Games />
      </div>
      <div className="animate-fade-in [animation-delay:200ms] [animation-fill-mode:both]">
        <HowItWorks />
      </div>
      <div className="animate-fade-in [animation-delay:200ms] [animation-fill-mode:both]">
        <Features />
      </div>
      <div className="animate-fade-in [animation-delay:200ms] [animation-fill-mode:both]">
        <CTA />
      </div>
    </SiteShell>
  ),
});

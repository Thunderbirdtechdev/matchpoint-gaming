import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { Hero } from "@/components/site/Hero";
import { Stats } from "@/components/site/Stats";
import { PlatformStats } from "@/components/site/PlatformStats";
import { Games } from "@/components/site/Games";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { Pricing } from "@/components/site/Pricing";
import { LeaderboardPreview } from "@/components/site/LeaderboardPreview";
import { Testimonials } from "@/components/site/Testimonials";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchPoint — Play. Compete. Win." },
      {
        name: "description",
        content:
          "Skill-based gaming platform. Compete in Fortnite, NBA 2K, Madden & College Football 1v1 challenges and tournaments for real cash prizes.",
      },
      { property: "og:title", content: "MatchPoint — Play. Compete. Win." },
      {
        property: "og:description",
        content: "Challenge players, enter tournaments, and prove your skills on MatchPoint.",
      },
      { property: "og:url", content: "https://matchpointgaming.org/" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/" }],
  }),
  component: HomePage,
});

function HomePage() {
  // Always open the landing page at the hero.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo(0, 0);
    }
  }, []);


  return (
    <SiteShell>
      <Hero />
      <Stats />
      <PlatformStats />
      <Games />
      <HowItWorks />
      <Features />
      <Pricing />
      <LeaderboardPreview />
      <Testimonials />
      <CTA />
    </SiteShell>
  );
}

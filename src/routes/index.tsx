import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteShell } from "@/components/site/SiteShell";
import { Hero } from "@/components/site/Hero";
import { Stats } from "@/components/site/Stats";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
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
          "Skill-based gaming platform. Compete in Fortnite, Madden, NBA 2K, MLB The Show, Call of Duty & EA Sports FC tournaments and win real cash prizes.",
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
  // Soft scroll-to-top on mount so the landing always opens at the hero.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <SiteShell>
      <Hero />
      <div className="animate-fade-in [animation-delay:100ms] [animation-fill-mode:both]">
        <Stats />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <HowItWorks />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <Features />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <LeaderboardPreview />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <Testimonials />
      </div>
      <div className="animate-fade-in [animation-delay:150ms] [animation-fill-mode:both]">
        <CTA />
      </div>
    </SiteShell>
  );
}

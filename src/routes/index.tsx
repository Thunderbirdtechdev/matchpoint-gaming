import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { Stats } from "@/components/site/Stats";
import { Games } from "@/components/site/Games";
import { HowItWorks } from "@/components/site/HowItWorks";
import { Features } from "@/components/site/Features";
import { CTA } from "@/components/site/CTA";
import { Footer } from "@/components/site/Footer";

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
        content:
          "Challenge players, enter tournaments, and prove your skills on MatchPoint.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Games />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

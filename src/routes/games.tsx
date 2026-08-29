import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Games } from "@/components/site/Games";
import { CTA } from "@/components/site/CTA";
import gameNba from "@/assets/game-nba.jpg";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Supported Games — MatchPoint" },
      { name: "description", content: "Compete in Fortnite, NBA 2K, Madden NFL and College Football 25 — with live 1v1 challenges and tournaments." },
      { property: "og:title", content: "Supported Games — MatchPoint" },
      { property: "og:description", content: "Browse all supported games on MatchPoint." },
      { property: "og:url", content: "https://matchpointgaming.org/games" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/games" }],
  }),
  component: () => (
    <SiteShell>
      <PageHeader
        eyebrow="Games"
        title={<>Four titles. Real <span className="text-gradient-brand">competition</span>.</>}
        description="Fortnite, NBA 2K, Madden NFL, and College Football 25 — with live challenges and tournaments running 24/7."
        image={{ src: gameNba, alt: "Competitive gaming action" }}
      />
      <Games />
      <CTA />
    </SiteShell>
  ),
});

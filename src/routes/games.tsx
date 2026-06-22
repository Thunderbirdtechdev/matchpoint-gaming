import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Games } from "@/components/site/Games";
import { CTA } from "@/components/site/CTA";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Supported Games — MatchPoint" },
      { name: "description", content: "Six flagship esports titles supported at launch with live competitions and tournaments 24/7." },
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
        title={<>Compete in the titles you <span className="text-gradient-brand">love</span></>}
        description="Six flagship games at launch — with live challenges and tournaments running 24/7. More titles roll out every season."
      />
      <Games />
      <CTA />
    </SiteShell>
  ),
});

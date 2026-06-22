import { createFileRoute } from "@tanstack/react-router";
import { Shield, Zap, Heart, Globe } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Stats } from "@/components/site/Stats";
import { CTA } from "@/components/site/CTA";

const values = [
  { icon: Shield, title: "Fair Play First", desc: "Every disputed match is reviewed by trained human moderators. No bots, no shortcuts." },
  { icon: Zap, title: "Built for Speed", desc: "Instant matchmaking, sub-second leaderboard updates, fast payouts on every win." },
  { icon: Heart, title: "Player-Owned", desc: "Players keep their winnings. We never charge platform fees on prize pools." },
  { icon: Globe, title: "Global Arena", desc: "Compete with players from 80+ countries across every supported title." },
];

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — MatchPoint" },
      { name: "description", content: "MatchPoint is the home of skill-based competitive gaming — built by players, for players." },
      { property: "og:title", content: "About MatchPoint" },
      { property: "og:description", content: "The home of skill-based competitive gaming." },
      { property: "og:url", content: "https://matchpointgaming.org/about" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="About"
        title={<>Built by players, <span className="text-gradient-brand">for players</span></>}
        description="MatchPoint started as a side project by competitive gamers tired of unpaid winnings and broken brackets. Today it's the fastest-growing skill-based gaming platform in North America."
      />

      <Stats />

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="rounded-2xl border border-border/60 bg-gradient-card p-7 shadow-card">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <v.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <CTA />
    </SiteShell>
  );
}

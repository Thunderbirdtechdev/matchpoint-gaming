import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MatchPoint" },
      { name: "description", content: "How MatchPoint collects, uses and protects your data." },
      { property: "og:title", content: "Privacy Policy — MatchPoint" },
      { property: "og:description", content: "What data MatchPoint collects, how we use it, and your rights." },
      { property: "og:url", content: "https://matchpointgaming.org/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/privacy" }],
  }),
  component: () => (
    <SiteShell>
      <PageHeader eyebrow="Legal" title="Privacy Policy" description="Last updated June 2026." />
      <section className="mx-auto max-w-3xl space-y-6 px-4 py-16 text-sm leading-relaxed text-muted-foreground sm:px-6">
        <p>Your privacy matters. This policy explains what we collect, how we use it and the choices you have.</p>
        <h2 className="text-base font-semibold text-foreground">Data we collect</h2>
        <p>Account info (email, username, country), gameplay data (match results, evidence uploads) and device data for fraud prevention.</p>
        <h2 className="text-base font-semibold text-foreground">How we use it</h2>
        <p>To operate the platform, verify match results, prevent cheating, process payouts and improve our service.</p>
        <h2 className="text-base font-semibold text-foreground">Your rights</h2>
        <p>You can request export or deletion of your data at any time from your profile settings or by emailing privacy@matchpoint.gg.</p>
      </section>
    </SiteShell>
  ),
});

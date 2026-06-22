import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  { q: "Is MatchPoint free to use?", a: "Yes. Creating an account, joining challenges and entering tournaments is free. We offer a Pro plan for instant payouts and advanced features." },
  { q: "How do payouts work?", a: "Once both players confirm a match result, winnings hit your wallet automatically. Standard accounts cash out within 48 hours; Pro accounts are instant." },
  { q: "What happens if there's a dispute?", a: "Either player can submit evidence (screenshots, replay or video). Our moderation team reviews every dispute within 24 hours and issues a final decision." },
  { q: "Which games are supported?", a: "Launch titles are Fortnite, Madden NFL, NBA 2K, MLB The Show, Call of Duty and EA Sports FC. More are added every season." },
  { q: "Is matchmaking skill-based?", a: "Yes. Reputation and recent performance feed into our matchmaker so you face opponents of similar skill." },
  { q: "Can I run my own tournament?", a: "Organizations can host branded tournaments using our bracket automation tools. Contact us for details." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — MatchPoint" },
      { name: "description", content: "Answers to the most common questions about MatchPoint — payouts, disputes, supported games and more." },
      { property: "og:title", content: "MatchPoint FAQ" },
      { property: "og:description", content: "Common questions, answered." },
      { property: "og:url", content: "https://matchpointgaming.org/faq" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: () => (
    <SiteShell>
      <PageHeader
        eyebrow="FAQ"
        title={<>Questions, <span className="text-gradient-brand">answered</span></>}
        description="If you can't find what you're looking for, reach out from the Contact page."
      />
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="overflow-hidden rounded-xl border border-border/60 bg-gradient-card px-5 shadow-card"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </SiteShell>
  ),
});

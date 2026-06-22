import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, LifeBuoy } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — MatchPoint" },
      { name: "description", content: "Get in touch with the MatchPoint team — partnerships, support, press." },
      { property: "og:title", content: "Contact MatchPoint" },
      { property: "og:description", content: "We reply to every message within one business day." },
      { property: "og:url", content: "https://matchpointgaming.org/contact" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Contact"
        title={<>Let's <span className="text-gradient-brand">talk</span></>}
        description="Partnerships, press, support — we reply to every message within one business day."
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div className="space-y-4">
          {[
            { icon: Mail, title: "Email", desc: "hello@matchpoint.gg" },
            { icon: MessageCircle, title: "Discord", desc: "discord.gg/matchpoint" },
            { icon: LifeBuoy, title: "Support", desc: "support@matchpoint.gg" },
          ].map((c) => (
            <div key={c.title} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <c.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <form className="space-y-5 rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-card">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" placeholder="What's this about?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" rows={5} placeholder="Tell us a bit more..." />
          </div>
          <Button className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
            Send message
          </Button>
        </form>
      </section>
    </SiteShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  submitContactMessage,
  CONTACT_TOPICS,
  TOPIC_LABELS,
  type ContactTopic,
} from "@/lib/contact.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * What the left column is for.
 *
 * It used to list an email address, a Discord invite and a support address —
 * all three placeholders on a domain the platform does not own
 * (`matchpoint.gg`, not matchpointgaming.org), so anyone who used them reached
 * nobody. Kevin asked for them gone and everything routed through the form,
 * which is right for a second reason: a form produces a row somebody owns,
 * while an address produces a message in an inbox nobody is accountable for.
 *
 * What replaces them is the pitch he actually wants this page to make. He is
 * looking for tournament organisers who would run their brackets on MatchPoint
 * under their own branding, and the enquiry form is no use if the page never
 * says that is on offer.
 */
const WHITE_LABEL_POINTS = [
  {
    title: "Brackets that run themselves",
    body: "Seeding, byes and advancement handled automatically. Report a result and the next round builds itself.",
  },
  {
    title: "Entry fees held in escrow",
    body: "Players stake into escrow rather than paying an organiser directly. Nobody is chasing anyone for money.",
  },
  {
    title: "Payouts without the admin",
    body: "Winners are paid from the prize pool on settlement, to a bank account or PayPal.",
  },
  {
    title: "Your name on it",
    body: "Run it as your league, your branding, your players. We handle the machinery.",
  },
];

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | MatchPoint" },
      {
        name: "description",
        content: "Get in touch with the MatchPoint team about partnerships, support or press.",
      },
      { property: "og:title", content: "Contact MatchPoint" },
      { property: "og:description", content: "We reply to every message within one business day." },
      { property: "og:url", content: "https://matchpointgaming.org/contact" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const submit = useServerFn(submitContactMessage);
  const [form, setForm] = useState({
    topic: "general" as ContactTopic,
    name: "",
    email: "",
    organisation: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  const m = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          topic: form.topic,
          name: form.name.trim(),
          email: form.email.trim(),
          organisation: form.organisation.trim() || undefined,
          subject: form.subject.trim(),
          message: form.message.trim(),
        },
      }),
    onSuccess: () => setSent(true),
    onError: (e: Error) => toast.error(e.message || "Could not send that. Try again."),
  });

  const canSend =
    form.name.trim() && form.email.trim() && form.subject.trim() && form.message.trim();

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Contact"
        title={
          <>
            Let's <span className="text-gradient-brand">talk</span>
          </>
        }
        description="Partnerships, press, support. We reply to every message within one business day."
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl tracking-tight">
            Run your tournaments on <span className="text-gradient-brand">MatchPoint</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            We built the bracket and payout machinery for our own platform, and we license it. If
            you run leagues, ladders or one-off events, you can run them on ours under your own
            branding.
          </p>

          <ul className="mt-8 space-y-5">
            {WHITE_LABEL_POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{p.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 rounded-xl border border-border/60 bg-surface/40 p-4 text-xs leading-relaxed text-muted-foreground">
            Pick <span className="text-foreground">Run tournaments with MatchPoint</span> in the
            form and tell us roughly how many players you run and how often. We reply to every
            message within one business day.
          </p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-card">
            <h2 className="text-lg font-semibold">Message sent</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Thanks {form.name.split(" ")[0] || "for getting in touch"}. We've got it and we'll
              reply to <span className="text-foreground">{form.email}</span> within one business
              day.
            </p>
          </div>
        ) : (
          <form
            className="space-y-5 rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-card"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSend) m.mutate();
            }}
          >
            {/* Topic first, because it changes what the rest of the form asks
                for and because it is how a partnership enquiry gets noticed
                among the password resets. */}
            <div className="space-y-2">
              <Label htmlFor="topic">What's this about?</Label>
              <Select
                value={form.topic}
                onValueChange={(v) => setForm({ ...form, topic: v as ContactTopic })}
              >
                <SelectTrigger id="topic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TOPIC_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            {form.topic === "partnership" && (
              <div className="space-y-2">
                <Label htmlFor="organisation">Organisation</Label>
                <Input
                  id="organisation"
                  placeholder="Your league, team or company"
                  value={form.organisation}
                  onChange={(e) => setForm({ ...form, organisation: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="What's this about?"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder={
                  form.topic === "partnership"
                    ? "How many players, how often you run tournaments, and what you'd want branded."
                    : "Tell us a bit more..."
                }
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={!canSend || m.isPending}
              className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90"
            >
              {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send message"}
            </Button>
          </form>
        )}
      </section>
    </SiteShell>
  );
}

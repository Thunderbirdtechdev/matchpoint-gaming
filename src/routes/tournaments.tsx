import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Users, Calendar, Coins } from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const tournaments = [
  { name: "Fortnite Friday Showdown", game: "Fortnite", format: "Single Elimination", prize: "$5,000", players: 128, starts: "Fri 8:00 PM ET", status: "Registering" },
  { name: "Madden Sunday Gauntlet", game: "Madden NFL", format: "Double Elimination", prize: "$2,500", players: 64, starts: "Sun 4:00 PM ET", status: "Registering" },
  { name: "NBA 2K Hardwood Classic", game: "NBA 2K", format: "Round Robin", prize: "$3,200", players: 32, starts: "Sat 7:00 PM ET", status: "Live" },
  { name: "COD Operator Open", game: "Call of Duty", format: "Single Elimination", prize: "$10,000", players: 256, starts: "Sat 9:00 PM ET", status: "Registering" },
  { name: "EA FC Champions League", game: "EA Sports FC", format: "League", prize: "$4,500", players: 48, starts: "Daily", status: "Live" },
  { name: "MLB The Show Diamond Cup", game: "MLB The Show", format: "Double Elimination", prize: "$1,800", players: 32, starts: "Sun 2:00 PM ET", status: "Registering" },
];

export const Route = createFileRoute("/tournaments")({
  head: () => ({
    meta: [
      { title: "Tournaments — MatchPoint" },
      { name: "description", content: "Browse open and live esports tournaments across all supported games with real prize pools." },
      { property: "og:title", content: "Tournaments — MatchPoint" },
      { property: "og:description", content: "Open registrations, live brackets, real prize pools." },
    ],
  }),
  component: TournamentsPage,
});

function TournamentsPage() {
  return (
    <SiteShell>
      <PageHeader
        eyebrow="Tournaments"
        title={<>Brackets. Stakes. <span className="text-gradient-gold">Glory.</span></>}
        description="Single elimination, double elimination, round robin, league. Pick a format and stake your claim."
      />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <article key={t.name} className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated">
              <div className="flex items-start justify-between">
                <Badge variant="outline" className="border-secondary/40 bg-secondary/10 text-secondary">
                  {t.game}
                </Badge>
                <Badge className={t.status === "Live" ? "bg-accent text-accent-foreground" : "bg-primary/20 text-primary"}>
                  {t.status === "Live" && <span className="mr-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent-foreground" />}
                  {t.status}
                </Badge>
              </div>

              <h3 className="mt-4 text-lg font-bold leading-snug">{t.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.format}</p>

              <dl className="mt-5 grid grid-cols-3 gap-3 text-sm">
                <Stat icon={Coins} label="Prize" value={t.prize} highlight />
                <Stat icon={Users} label="Slots" value={`${t.players}`} />
                <Stat icon={Calendar} label="Starts" value={t.starts} />
              </dl>

              <Button className="mt-6 w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
                <Trophy className="mr-2 h-4 w-4" />
                {t.status === "Live" ? "Watch Live" : "Register"}
              </Button>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Coins; label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 font-bold ${highlight ? "text-gradient-gold" : ""}`}>{value}</div>
    </div>
  );
}

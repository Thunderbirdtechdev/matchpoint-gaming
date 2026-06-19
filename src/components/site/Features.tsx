import {
  Swords, Trophy, BarChart3, ShieldCheck, Users, Zap, Star, Gavel,
} from "lucide-react";

const features = [
  { icon: Swords, title: "Challenge System", desc: "Create public or private challenges with custom rules and entry stakes." },
  { icon: Trophy, title: "Tournament System", desc: "Single, double elimination, round robin and league formats." },
  { icon: BarChart3, title: "Leaderboards", desc: "Global, monthly and season rankings across every supported title." },
  { icon: Star, title: "Reputation System", desc: "Build trust through clean play, completed matches and reviews." },
  { icon: ShieldCheck, title: "Dispute Protection", desc: "Evidence-based moderation team protects every result." },
  { icon: Users, title: "Community Features", desc: "Friends, follows, achievements and player profiles." },
  { icon: Zap, title: "Fast Payouts", desc: "Withdraw winnings to your wallet the moment a match is verified." },
  { icon: Gavel, title: "Moderation Team", desc: "Trained moderators review every flagged match within hours." },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">Platform</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Built for serious competitors
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every tool you need to host fair, fast and rewarding competitive matches.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import {
  Swords, Trophy, BarChart3, ShieldCheck, Wallet, Zap, Lock, Gavel,
} from "lucide-react";

const features = [
  { icon: Swords, title: "1v1 Challenges", desc: "Create or accept head-to-head matches with custom rules and real-money stakes starting at $10." },
  { icon: Trophy, title: "Tournaments", desc: "Join multi-player brackets with configurable payout structures and prize pools." },
  { icon: Wallet, title: "Secure Wallet", desc: "Deposit via card, track every transaction, and cash out to your bank — powered by Stripe." },
  { icon: Lock, title: "Escrow Protection", desc: "Entry fees are locked in escrow until the match is verified. No one touches funds early." },
  { icon: ShieldCheck, title: "Fair Play Disputes", desc: "Upload evidence, our moderation team reviews and resolves disputes within hours." },
  { icon: Zap, title: "Instant Payouts", desc: "Standard withdrawals are free. Same-day cash outs land in your bank in hours." },
  { icon: BarChart3, title: "Leaderboards & Stats", desc: "Track your W/L record, earnings, rank tier, and reputation across all games." },
  { icon: Gavel, title: "Transparent Fees", desc: "Clear fee tiers based on entry amount. No hidden charges — you always see what you'll win." },
];

export function Features() {
  return (
    <section id="features" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="max-w-2xl">
            <p className="font-display text-sm tracking-[0.28em] text-accent">Platform</p>
            <h2 className="mt-3 font-display text-5xl tracking-wide sm:text-6xl">
              Built for serious competitors
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            Every tool you need to host fair, fast and rewarding competitive matches.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative bg-background p-6 transition-colors duration-300 hover:bg-surface/60"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary-glow ring-1 ring-primary/25 transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-xl tracking-wide">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useRef } from "react";
import {
  SwordsIcon,
  UsersIcon,
  WalletIcon,
  LockIcon,
  ShieldCheckIcon,
  ZapIcon,
  ChartColumnIcon,
  ReceiptTextIcon,
  type AnimatedIconHandle,
} from "@/components/ui/animated-icons";
import { IconTile } from "@/components/ui/icon-tile";

const features = [
  {
    icon: SwordsIcon,
    title: "1v1 Challenges",
    desc: "Create or accept head-to-head matches with custom rules and real-money stakes starting at $10.",
  },
  {
    icon: UsersIcon,
    title: "Tournaments",
    desc: "Join multi-player brackets with configurable payout structures and prize pools.",
  },
  {
    icon: WalletIcon,
    title: "Secure Wallet",
    desc: "Deposit via card, track every transaction, and cash out to your bank, powered by Stripe.",
  },
  {
    icon: LockIcon,
    title: "Escrow Protection",
    desc: "Entry fees are locked in escrow until the match is verified. No one touches funds early.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Fair Play Disputes",
    desc: "Upload evidence, our moderation team reviews and resolves disputes within hours.",
  },
  {
    icon: ZapIcon,
    title: "Instant Payouts",
    desc: "Standard withdrawals are free. Same-day cash outs land in your bank in hours.",
  },
  {
    icon: ChartColumnIcon,
    title: "Leaderboards & Stats",
    desc: "Track your W/L record, earnings, rank tier, and reputation across all games.",
  },
  {
    icon: ReceiptTextIcon,
    title: "Transparent Fees",
    desc: "Clear fee tiers based on entry amount. No hidden charges. You always see what you'll win.",
  },
];

function FeatureCard({ f }: { f: (typeof features)[number] }) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = f.icon;

  return (
    <div
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      className="group relative bg-background p-6 transition-colors duration-300 hover:bg-surface/60"
    >
      <IconTile>
        <Icon ref={iconRef} size={20} />
      </IconTile>
      <h3 className="mt-5 font-display text-xl tracking-wide">{f.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
    </div>
  );
}

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
            <FeatureCard key={f.title} f={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

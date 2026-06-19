import { UserPlus, Swords, Gamepad2, Upload, Trophy } from "lucide-react";

const steps = [
  { icon: UserPlus, title: "Create Account", desc: "Sign up free in under a minute and verify your email." },
  { icon: Swords, title: "Join Competition", desc: "Pick a challenge or tournament that matches your skill." },
  { icon: Gamepad2, title: "Play Match", desc: "Battle your opponent on your favorite platform." },
  { icon: Upload, title: "Submit Results", desc: "Upload screenshots, replays or video as evidence." },
  { icon: Trophy, title: "Earn Rewards", desc: "Climb leaderboards and cash out your winnings fast." },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-border/50 bg-surface/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
            From signup to payout in 5 steps
          </h2>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          <ol className="grid gap-8 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="relative text-center">
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-card shadow-card ring-1 ring-border">
                  <s.icon className="h-7 w-7 text-primary" />
                  <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

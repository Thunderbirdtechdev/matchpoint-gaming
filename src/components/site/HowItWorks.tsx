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
    <section id="how" className="relative border-b border-border/50 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="font-display text-sm tracking-[0.28em] text-accent">How it works</p>
          <h2 className="mt-3 font-display text-5xl tracking-wide sm:text-6xl">
            From signup to payout in 5 steps
          </h2>
        </div>

        <div className="relative mt-16">
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />
          <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-border/60 bg-gradient-card font-display text-2xl tracking-wide text-primary-glow shadow-card">
                    {i + 1}
                  </span>
                  <s.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                </div>
                <h3 className="mt-5 font-display text-2xl tracking-wide">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

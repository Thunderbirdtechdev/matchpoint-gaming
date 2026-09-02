import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Zap,
  Users,
  Globe,
  Target,
  Trophy,
  ArrowRight,
  Landmark,
  Scale,
  HeadsetIcon,
} from "lucide-react";
import { SiteShell } from "@/components/site/SiteShell";
import { CTA } from "@/components/site/CTA";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";
import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";

/* ─── Data ─── */

const mission = {
  title: "Our Mission",
  text: "To build the fairest, fastest, and most rewarding competitive gaming platform on the planet — where every player has a real shot at winning.",
};

const story = [
  {
    year: "2024",
    title: "The Problem",
    text: "Competitive gamers were stuck dealing with shady wager sites, unpaid winnings, broken brackets, and zero dispute protection. We knew there had to be a better way.",
  },
  {
    year: "2024",
    title: "The Build",
    text: "A small team of competitive gamers and engineers started building MatchPoint — a platform with Stripe-powered payouts, human-reviewed disputes, and real accountability.",
  },
  {
    year: "2025",
    title: "The Launch",
    text: "MatchPoint went live with Fortnite, NBA 2K, Madden NFL, and College Football 25. 1v1 challenges and tournaments — all skill-based, all legit.",
  },
  {
    year: "2026",
    title: "Today",
    text: "Thousands of players compete on MatchPoint daily. We're growing fast, expanding game support, and building the future of competitive gaming.",
  },
];

const values = [
  {
    icon: Shield,
    title: "Fair Play Guaranteed",
    desc: "Every disputed match is reviewed by trained human moderators. We verify clips, screenshots, and game data. No bots, no bias.",
  },
  {
    icon: Zap,
    title: "Instant Everything",
    desc: "Sub-second matchmaking, real-time leaderboard updates, and same-day payouts. Speed isn't a feature — it's the standard.",
  },
  {
    icon: Landmark,
    title: "Secure & Transparent",
    desc: "All transactions powered by Stripe. Your money is protected, fees are public, and payouts are guaranteed. No hidden charges ever.",
  },
  {
    icon: Scale,
    title: "Skill-Based Only",
    desc: "No pay-to-win mechanics, no random matchmaking. You win because you're better. Period.",
  },
  {
    icon: Users,
    title: "Community First",
    desc: "Built by competitive gamers who've been in the trenches. Every feature exists because a player asked for it.",
  },
  {
    icon: HeadsetIcon,
    title: "24/7 Support",
    desc: "Real humans answering real questions. Dispute resolution, account help, payout issues — we've got your back around the clock.",
  },
];

const stats = [
  { value: "4", label: "Supported Games" },
  { value: "24/7", label: "Live Support" },
  { value: "<5min", label: "Avg. Dispute Resolution" },
  { value: "$0", label: "Platform Fees on Deposits" },
];

const team = [
  { role: "Founders", desc: "Competitive Fortnite and Madden players who got tired of getting scammed on wager sites." },
  { role: "Engineering", desc: "Full-stack engineers building real-time systems that handle thousands of concurrent matches." },
  { role: "Trust & Safety", desc: "Former esports moderators who review every dispute with evidence-based protocols." },
  { role: "Community", desc: "Player advocates who gather feedback, run events, and keep the community thriving." },
];

/* ─── Hooks ─── */

function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setVisible(true);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect, threshold]);
  return { ref, visible };
}

function useSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }, []);
  return { ref, onMove };
}

/* ─── Components ─── */

function ValueCard({ v, i, visible }: { v: (typeof values)[number]; i: number; visible: boolean }) {
  const { ref, onMove } = useSpotlight();
  const Icon = v.icon;
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group relative overflow-hidden rounded-2xl transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${i * 100 + 200}ms` }}
    >
      {/* Border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-border/40 via-border/20 to-border/40 transition-all duration-300 ease-out group-hover:-translate-y-0.5 group-hover:from-primary/50 group-hover:via-primary/20 group-hover:to-primary/50" />
      {/* Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(350px circle at var(--spot-x, 50%) var(--spot-y, 50%), oklch(0.51 0.23 277 / 0.07), transparent 60%)" }}
      />
      <div className="relative rounded-[15px] bg-background/70 p-7 transition-transform duration-300 group-hover:-translate-y-0.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-all duration-300 group-hover:bg-primary/15 group-hover:ring-primary/40 group-hover:shadow-[0_0_16px_oklch(0.51_0.23_277_/_0.15)]">
          <Icon className="h-5.5 w-5.5 text-primary" />
        </div>
        <h3 className="mt-5 text-lg font-semibold">{v.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{v.desc}</p>
      </div>
    </div>
  );
}

/* ─── Page ─── */

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — MatchPoint" },
      { name: "description", content: "MatchPoint is the home of skill-based competitive gaming — built by players, for players." },
      { property: "og:title", content: "About MatchPoint" },
      { property: "og:description", content: "The home of skill-based competitive gaming." },
      { property: "og:url", content: "https://matchpointgaming.org/about" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  const hero = useReveal(0.1);
  const missionSection = useReveal();
  const storySection = useReveal();
  const valuesSection = useReveal();
  const statsSection = useReveal();
  const teamSection = useReveal();

  return (
    <SiteShell>
      {/* ── Hero ── */}
      <section ref={hero.ref} className="relative overflow-hidden border-b border-border/50">
        <BackgroundPattern />
        <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 md:py-32">
          <p
            className={`font-display text-xs tracking-[0.3em] uppercase text-accent transition-all duration-700 ${
              hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            About MatchPoint
          </p>
          <h1
            className={`mt-4 font-display text-4xl font-black uppercase tracking-tight sm:text-5xl md:text-6xl lg:text-7xl transition-all duration-700 delay-100 ${
              hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Built by Players,{" "}
            <span className="text-gradient-brand">for Players</span>
          </h1>
          <p
            className={`mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed transition-all duration-700 delay-200 ${
              hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            We started MatchPoint because we were tired of broken promises in competitive gaming.
            Unpaid winnings. Rigged brackets. Zero accountability. So we built something better.
          </p>
          <div
            className={`mt-8 flex justify-center gap-3 transition-all duration-700 delay-300 ${
              hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <Link
              to="/register"
              className="leaderboard-cta group relative inline-flex h-13 items-center gap-3 overflow-hidden rounded-xl bg-gradient-brand px-8 font-display text-base uppercase tracking-[0.12em] text-primary-foreground transition-all duration-300 hover:shadow-[0_0_30px_oklch(0.51_0.23_277_/_0.35)]"
            >
              <span className="absolute inset-0 leaderboard-btn-shimmer" />
              <span className="relative">Join MatchPoint</span>
              <ArrowRight className="relative h-4.5 w-4.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Mission ── */}
      <section ref={missionSection.ref} className="relative border-b border-border/50 bg-surface/20">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 md:py-24">
          <div
            className={`transition-all duration-700 ${
              missionSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <Target className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-5 font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
              {mission.title}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {mission.text}
            </p>
          </div>
        </div>
      </section>

      {/* ── Our Story Timeline ── */}
      <section ref={storySection.ref} className="relative border-b border-border/50 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div
            className={`text-center transition-all duration-700 ${
              storySection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">Our Journey</p>
            <h2 className="mt-3 font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
              The <span className="text-gradient-brand">Story</span> So Far
            </h2>
          </div>

          <div className="relative mt-14">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border/30 md:left-1/2 md:-translate-x-px">
              <div
                className="absolute top-0 w-full bg-gradient-to-b from-primary/60 to-primary/10 transition-all duration-[2000ms] ease-out"
                style={{ height: storySection.visible ? "100%" : "0%" }}
              />
            </div>

            <div className="space-y-12 md:space-y-16">
              {story.map((s, i) => {
                const isLeft = i % 2 === 0;
                return (
                  <div
                    key={i}
                    className={`relative flex items-start gap-6 transition-all duration-700 ${
                      storySection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                    } ${isLeft ? "md:flex-row" : "md:flex-row-reverse"}`}
                    style={{ transitionDelay: `${i * 200 + 300}ms` }}
                  >
                    {/* Dot */}
                    <div className="absolute left-4 top-1 z-10 md:left-1/2 md:-translate-x-1/2">
                      <div className="h-3 w-3 rounded-full border-2 border-primary bg-background shadow-[0_0_8px_oklch(0.51_0.23_277_/_0.4)]" />
                    </div>

                    {/* Content */}
                    <div className={`ml-12 md:ml-0 md:w-[calc(50%-2rem)] ${isLeft ? "md:text-right md:pr-8" : "md:text-left md:pl-8 md:ml-auto"}`}>
                      <span className="font-display text-xs tracking-[0.2em] uppercase text-primary">{s.year}</span>
                      <h3 className="mt-1 font-display text-xl tracking-wide sm:text-2xl">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <section ref={statsSection.ref} className="relative border-b border-border/30 bg-background">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`flex flex-col items-center text-center transition-all duration-700 ${
                  statsSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <span className="font-display text-4xl tracking-wide text-foreground sm:text-5xl">
                  {s.value}
                </span>
                <span className="mt-2 text-xs tracking-[0.15em] uppercase text-muted-foreground">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section ref={valuesSection.ref} className="relative border-b border-border/50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div
            className={`text-center transition-all duration-700 ${
              valuesSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">What We Stand For</p>
            <h2 className="mt-3 font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
              Our <span className="text-gradient-brand">Values</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((v, i) => (
              <ValueCard key={v.title} v={v} i={i} visible={valuesSection.visible} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ── */}
      <section ref={teamSection.ref} className="relative border-b border-border/50 bg-surface/20 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div
            className={`text-center transition-all duration-700 ${
              teamSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">The Team</p>
            <h2 className="mt-3 font-display text-3xl tracking-wide sm:text-4xl md:text-5xl">
              Who's Behind <span className="text-gradient-brand">MatchPoint</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              We're a small, focused team of gamers, engineers, and community builders. No investors pulling strings — just people who care about competitive gaming.
            </p>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {team.map((t, i) => (
              <div
                key={t.role}
                className={`rounded-2xl border border-border/40 bg-background/60 p-7 backdrop-blur transition-all duration-700 hover:border-primary/30 ${
                  teamSection.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ transitionDelay: `${i * 120 + 200}ms` }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-display text-lg tracking-wide">{t.role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CTA />
    </SiteShell>
  );
}

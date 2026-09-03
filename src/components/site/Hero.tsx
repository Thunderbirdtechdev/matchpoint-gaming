import { Link } from "@tanstack/react-router";
import { ArrowRight, Play, Zap, Shield, Swords } from "lucide-react";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { HeroSlideshow } from "@/components/site/HeroSlideshow";
import { Typewriter } from "@/components/ui/typewriter";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";

const trust = [
  { icon: Shield, label: "Verified matches" },
  { icon: Zap, label: "Instant payouts" },
  { icon: Swords, label: "Escrow-protected" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      <BackgroundPattern />
      <div className="absolute -left-40 -top-24 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -right-32 top-40 h-[26rem] w-[26rem] rounded-full bg-primary-glow/15 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-20 sm:px-6 md:pb-12 md:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-12">
          {/* Left — message */}
          <div>
            <h1 className="font-display text-7xl leading-[0.88] tracking-wide sm:text-8xl md:text-[7.5rem]">
              <span className="block overflow-hidden">
                <span className="inline-block animate-hero-word">Play.</span>
              </span>
              <span className="block overflow-hidden">
                <span className="inline-block animate-hero-word [animation-delay:150ms] animate-hero-glow">
                  Compete.
                </span>
              </span>
              <span className="mt-1 block overflow-hidden">
                <span className="inline-block animate-hero-word [animation-delay:300ms] text-gradient-brand animate-hero-gradient">
                  Win.
                </span>
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg animate-hero-word [animation-delay:500ms]">
              MatchPoint is the skill-based arena where real gamers settle it. Challenge anyone to a
              1v1 in Fortnite, NBA 2K27, Madden NFL 27, NCAA 27 or MLB The Show 27 — stake real
              money, compete head-to-head, and cash out your winnings instantly to your bank. No
              middlemen. No excuses.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row animate-hero-word [animation-delay:650ms]">
              <InteractiveHoverButton
                asChild
                text="Enter the Arena"
                icon={<ArrowRight className="h-5 w-5" />}
                className="w-48 border-primary/50 bg-background p-3 font-display text-base tracking-[0.08em] sm:w-52"
              >
                <Link to="/register" />
              </InteractiveHoverButton>
              <InteractiveHoverButton
                asChild
                text="Browse Games"
                icon={<Play className="h-5 w-5" />}
                className="w-48 border-border/80 bg-surface/40 p-3 font-display text-base tracking-[0.08em] backdrop-blur sm:w-52"
              >
                <Link to="/games" />
              </InteractiveHoverButton>
            </div>

            {/* Typewriter tagline under buttons */}
            <div className="mt-6 h-6 animate-hero-word [animation-delay:800ms]">
              <Typewriter
                text={[
                  "1v1 Challenges · Tournaments · Real Cash Prizes",
                  "Fortnite · NBA 2K27 · Madden NFL 27 · NCAA 27 · MLB The Show 27",
                  "$10 Minimum Entry · Free Withdrawals · Instant Payouts",
                ]}
                speed={40}
                deleteSpeed={20}
                waitTime={3000}
                initialDelay={1200}
                loop
                showCursor
                cursorChar="|"
                cursorClassName="ml-1 text-primary-glow"
                className="text-sm text-muted-foreground font-display tracking-[0.12em] uppercase"
              />
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-border/50 pt-6 animate-hero-word [animation-delay:950ms]">
              {trust.map((t) => (
                <li key={t.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <t.icon className="h-4 w-4 shrink-0 text-primary-glow" />
                  {t.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — game slideshow */}
          <div className="animate-fade-in [animation-delay:120ms] [animation-fill-mode:both]">
            <HeroSlideshow />
          </div>
        </div>
      </div>
    </section>
  );
}

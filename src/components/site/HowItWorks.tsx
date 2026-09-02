import { useEffect, useRef, useState, useCallback } from "react";
import {
  UserPlusIcon,
  ShieldCheckIcon,
  LocateFixedIcon,
  SwordsIcon,
  WalletIcon,
  type AnimatedIconHandle,
} from "@/components/ui/animated-icons";
import { IconTile } from "@/components/ui/icon-tile";

const steps = [
  {
    icon: UserPlusIcon,
    title: "Sign Up",
    desc: "Create your account in under a minute — completely free.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Verify & Fund",
    desc: "Confirm your email, verify your age, and deposit funds to your wallet.",
  },
  {
    icon: LocateFixedIcon,
    title: "Find a Match",
    desc: "Browse the marketplace for 1v1 challenges or tournaments in your game.",
  },
  {
    icon: SwordsIcon,
    title: "Compete",
    desc: "Play your match and submit the result. Both players confirm the winner.",
  },
  {
    icon: WalletIcon,
    title: "Win & Cash Out",
    desc: "Winnings land in your wallet instantly. Cash out to your bank anytime.",
  },
];

function Step({
  step,
  i,
  visible,
  isLast,
}: {
  step: (typeof steps)[number];
  i: number;
  visible: boolean;
  isLast: boolean;
}) {
  const iconRef = useRef<AnimatedIconHandle>(null);
  const Icon = step.icon;

  return (
    <div
      onMouseEnter={() => iconRef.current?.startAnimation()}
      onMouseLeave={() => iconRef.current?.stopAnimation()}
      className={`group relative flex flex-col items-center text-center transition-all duration-700 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
      style={{ transitionDelay: `${i * 180 + 200}ms` }}
    >
      {/* Step indicator circle */}
      <div className="relative z-10 mb-6">
        {/* Ping ring on arrival */}
        <div
          className="absolute -inset-2 rounded-full border border-primary/40"
          style={{
            animation: visible
              ? `hiw-ping 0.8s cubic-bezier(0, 0, 0.2, 1) ${i * 180 + 600}ms both`
              : "none",
            opacity: 0,
          }}
        />
        {/* Soft glow behind circle */}
        <div
          className="absolute inset-0 rounded-full transition-all duration-700"
          style={{
            background: "radial-gradient(circle, oklch(0.51 0.23 277 / 0.15), transparent 70%)",
            transform: visible ? "scale(2.5)" : "scale(0)",
            opacity: visible ? 1 : 0,
            transitionDelay: `${i * 180 + 500}ms`,
          }}
        />
        {/* Circle with number */}
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-border/60 bg-background transition-all duration-500"
          style={{
            borderColor: visible ? "oklch(0.51 0.23 277 / 0.6)" : undefined,
            boxShadow: visible ? "0 0 16px oklch(0.51 0.23 277 / 0.2)" : "none",
            transitionDelay: `${i * 180 + 400}ms`,
            animation: visible
              ? `hiw-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 180 + 400}ms both`
              : "none",
          }}
        >
          <span className="font-display text-lg text-primary-glow">{i + 1}</span>
        </div>
      </div>

      {/* Mobile vertical connector */}
      {!isLast && (
        <div
          className="absolute top-[56px] left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-primary/30 to-transparent sm:hidden transition-all duration-700"
          style={{
            height: visible ? "calc(100% + 40px - 56px)" : "0px",
            transitionDelay: `${i * 180 + 600}ms`,
          }}
        />
      )}

      {/* Icon */}
      <IconTile
        size="lg"
        className="mb-4"
        style={{
          animation: visible
            ? `hiw-icon-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 180 + 700}ms both`
            : "none",
        }}
      >
        <Icon ref={iconRef} size={22} className="hiw-icon-float" />
      </IconTile>

      {/* Text */}
      <h3
        className="font-display text-lg tracking-wide sm:text-xl"
        style={{
          animation: visible
            ? `hiw-text-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 180 + 800}ms both`
            : "none",
          opacity: 0,
        }}
      >
        {step.title}
      </h3>
      <p
        className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-muted-foreground"
        style={{
          animation: visible
            ? `hiw-text-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 180 + 900}ms both`
            : "none",
          opacity: 0,
        }}
      >
        {step.desc}
      </p>
    </div>
  );
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setVisible(true);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <section
      id="how"
      ref={sectionRef}
      className="relative overflow-hidden border-b border-border/50 py-20 md:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div
          className={`text-center transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <p className="font-display text-xs tracking-[0.3em] uppercase text-accent">
            How it works
          </p>
          <h2 className="mt-3 font-display text-4xl tracking-wide sm:text-5xl md:text-6xl">
            From Signup to Payout in <span className="text-gradient-brand">5 Steps</span>
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative mt-16 sm:mt-20">
          {/* Desktop horizontal connector line */}
          <div className="pointer-events-none absolute top-[28px] left-[10%] right-[10%] hidden lg:block">
            {/* Track */}
            <div className="h-px w-full bg-border/50" />
            {/* Animated fill */}
            <div
              className="absolute top-0 left-0 h-px transition-all duration-[2000ms] ease-out"
              style={{
                width: visible ? "100%" : "0%",
                background:
                  "linear-gradient(90deg, oklch(0.51 0.23 277 / 0.8), oklch(0.51 0.23 277), oklch(0.51 0.23 277 / 0.8))",
                boxShadow: visible
                  ? "0 0 8px oklch(0.51 0.23 277 / 0.4), 0 0 20px oklch(0.51 0.23 277 / 0.15)"
                  : "none",
              }}
            />
            {/* Traveling dot on the line */}
            <div
              className="absolute top-[-2.5px] h-[6px] w-[6px] rounded-full bg-primary transition-all duration-[2000ms] ease-out"
              style={{
                left: visible ? "100%" : "0%",
                opacity: visible ? 1 : 0,
                boxShadow:
                  "0 0 10px oklch(0.51 0.23 277 / 0.8), 0 0 20px oklch(0.51 0.23 277 / 0.4)",
              }}
            />
          </div>

          <div className="grid gap-10 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-5 lg:gap-6">
            {steps.map((step, i) => (
              <Step
                key={step.title}
                step={step}
                i={i}
                visible={visible}
                isLast={i === steps.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

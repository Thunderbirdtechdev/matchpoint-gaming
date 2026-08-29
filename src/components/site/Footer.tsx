import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

const socials = [
  {
    label: "Twitter",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "#",
    icon: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

/** Floating particles component */
function FooterParticles({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 4 + 6,
    }))
  ).current;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-primary/20 footer-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: visible ? 1 : 0,
            transition: "opacity 1s ease",
          }}
        />
      ))}
    </div>
  );
}

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting) setVisible(true);
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <footer ref={footerRef} className="relative overflow-hidden bg-background">
      {/* Top divider with animated sweep */}
      <div className="relative h-px">
        <div className="absolute inset-0 bg-border/40" />
        <div
          className="absolute inset-0 footer-divider-sweep"
          style={{
            background: "linear-gradient(90deg, transparent 0%, oklch(0.51 0.23 277 / 0.6) 50%, transparent 100%)",
            backgroundSize: "50% 100%",
            opacity: visible ? 1 : 0,
          }}
        />
      </div>

      {/* Ambient background glow */}
      <div
        className="absolute top-0 left-1/4 h-[400px] w-[500px] -translate-y-1/2 rounded-full blur-[120px] footer-glow-drift"
        style={{ background: "oklch(0.35 0.15 277 / 0.08)" }}
      />
      <div
        className="absolute bottom-0 right-1/4 h-[300px] w-[400px] translate-y-1/2 rounded-full blur-[100px] footer-glow-drift-alt"
        style={{ background: "oklch(0.3 0.12 290 / 0.06)" }}
      />

      {/* Particles */}
      <FooterParticles visible={visible} />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-10 sm:px-6 md:pt-20 md:pb-12">
        {/* Main grid */}
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand column */}
          <div
            className={`lg:col-span-4 footer-col-reveal ${visible ? "footer-col-visible" : ""}`}
            style={{ transitionDelay: "0ms" }}
          >
            {/* Logo with hover glow */}
            <Link to="/" className="group inline-flex items-center gap-3">
              <div className="relative">
                <div className="absolute -inset-1.5 rounded-xl bg-gradient-brand opacity-0 blur-md transition-opacity duration-400 group-hover:opacity-50" />
                <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand transition-shadow duration-400 group-hover:shadow-[0_0_20px_oklch(0.51_0.23_277_/_0.4)]">
                  <Trophy className="h-5 w-5 text-primary-foreground" />
                </div>
              </div>
              <span className="text-xl font-bold tracking-tight">
                Match<span className="text-gradient-brand">Point</span>
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Skill-based competitive gaming. Create challenges, join tournaments and
              earn rewards across your favorite titles.
            </p>

            {/* Social icons */}
            <div className="mt-6 flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface/60 text-muted-foreground ring-1 ring-border/30 transition-all duration-300 hover:text-primary hover:bg-primary/10 hover:ring-primary/30 hover:shadow-[0_0_14px_oklch(0.51_0.23_277_/_0.2)] hover:scale-110"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div
            className={`lg:col-span-2 footer-col-reveal ${visible ? "footer-col-visible" : ""}`}
            style={{ transitionDelay: "120ms" }}
          >
            <FooterCol
              title="Platform"
              items={[
                { to: "/games", label: "Games" },
                { to: "/how-it-works", label: "How it works" },
                { to: "/faq", label: "FAQ" },
              ]}
            />
          </div>

          <div
            className={`lg:col-span-3 footer-col-reveal ${visible ? "footer-col-visible" : ""}`}
            style={{ transitionDelay: "240ms" }}
          >
            <FooterCol
              title="Company"
              items={[
                { to: "/about", label: "About" },
                { to: "/contact", label: "Contact" },
                { to: "/terms", label: "Terms of Service" },
                { to: "/privacy", label: "Privacy Policy" },
              ]}
            />
          </div>

          <div
            className={`lg:col-span-3 footer-col-reveal ${visible ? "footer-col-visible" : ""}`}
            style={{ transitionDelay: "360ms" }}
          >
            <FooterCol
              title="Get Started"
              items={[
                { to: "/register", label: "Create Account" },
                { to: "/login", label: "Sign in" },
              ]}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className={`mt-14 flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-7 text-[13px] text-muted-foreground/60 md:flex-row footer-col-reveal ${visible ? "footer-col-visible" : ""}`}
          style={{ transitionDelay: "500ms" }}
        >
          <p>© {new Date().getFullYear()} MatchPoint. Play. Compete. Win.</p>
          <p>All trademarks are property of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { to: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
        {title}
      </h4>
      <ul className="mt-5 space-y-3 text-sm">
        {items.map((i) => (
          <li key={i.to}>
            <Link
              to={i.to}
              className="group/link relative inline-flex items-center text-muted-foreground transition-all duration-300 hover:text-foreground hover:translate-x-1.5"
            >
              <span className="relative">
                {i.label}
                {/* Animated underline */}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-gradient-to-r from-primary to-primary/50 transition-all duration-300 group-hover/link:w-full" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

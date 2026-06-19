import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand">
                <Trophy className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">
                Match<span className="text-gradient-brand">Point</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Skill-based competitive gaming. Create challenges, join tournaments and
              earn rewards across your favorite titles.
            </p>
          </div>

          <FooterCol
            title="Platform"
            items={[
              { to: "/games", label: "Games" },
              { to: "/tournaments", label: "Tournaments" },
              { to: "/leaderboards", label: "Leaderboards" },
              { to: "/how-it-works", label: "How it works" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { to: "/about", label: "About" },
              { to: "/pricing", label: "Pricing" },
              { to: "/contact", label: "Contact" },
              { to: "/faq", label: "FAQ" },
            ]}
          />
          <FooterCol
            title="Account"
            items={[
              { to: "/login", label: "Sign in" },
              { to: "/register", label: "Create Account" },
              { to: "/terms", label: "Terms" },
              { to: "/privacy", label: "Privacy" },
            ]}
          />
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 text-sm text-muted-foreground md:flex-row">
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
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="transition-colors hover:text-foreground">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

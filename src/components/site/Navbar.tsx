import { Link } from "@tanstack/react-router";
import { Trophy, Menu, X, LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { to: "/games", label: "Games" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/leaderboards", label: "Leaderboards" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-brand glow-primary transition-transform group-hover:scale-105">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-extrabold uppercase tracking-[0.12em]">
            Match<span className="text-gradient-brand">Point</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground lg:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="relative py-1 transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground font-bold uppercase tracking-wider hover:opacity-90">
              <Link to="/dashboard"><LayoutDashboard className="mr-1.5 h-4 w-4" />Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-wider">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-90">
                <Link to="/register">Play Free</Link>
              </Button>
            </>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1 grid h-9 w-9 place-items-center rounded-md border border-border/60 lg:hidden"
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
                activeProps={{ className: "text-foreground bg-surface" }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground sm:hidden"
            >
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

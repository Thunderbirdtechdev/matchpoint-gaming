import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const links = [
  { to: "/games", label: "Games" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/about", label: "About" },
  { to: "/faq", label: "FAQ" },
] as const;

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeLink = links.find((l) => pathname.startsWith(l.to))?.to ?? null;
  const highlight = hovered ?? activeLink;

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group">
          <img
            src={logo}
            alt="MatchPoint Gaming"
            className="h-9 w-9 rounded-lg object-contain transition-transform group-hover:scale-105"
            width={36}
            height={36}
          />
          <span className="font-display text-lg font-extrabold uppercase tracking-[0.12em]">
            Match<span className="text-gradient-brand">Point</span>
          </span>
        </Link>

        <nav
          onMouseLeave={() => setHovered(null)}
          className="hidden items-center gap-0.5 text-[12px] font-bold uppercase tracking-wider lg:flex lg:ml-auto lg:mr-4"
        >
          {links.map((l) => {
            const isActive = activeLink === l.to;
            return (
              <Link
                key={l.to}
                to={l.to}
                onMouseEnter={() => setHovered(l.to)}
                className={`relative rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-colors duration-200 ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {highlight === l.to && (
                  <motion.span
                    layoutId="nav-highlight"
                    className="absolute inset-0 rounded-lg bg-surface/70 ring-1 ring-inset ring-border/50"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button
              asChild
              size="sm"
              className="group relative overflow-hidden bg-gradient-brand text-primary-foreground font-bold uppercase tracking-wider transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_var(--primary-glow)] active:translate-y-0"
            >
              <Link to="/dashboard">
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                <span className="relative z-10 inline-flex items-center">
                  <LayoutDashboard className="mr-1.5 h-4 w-4" />Dashboard
                </span>
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-wider">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="group relative overflow-hidden bg-gradient-brand text-primary-foreground text-xs font-bold uppercase tracking-wider transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-6px_var(--primary-glow)] active:translate-y-0"
              >
                <Link to="/register">
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
                  <span className="relative z-10">Play Free</span>
                </Link>
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

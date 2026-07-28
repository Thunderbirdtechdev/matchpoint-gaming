import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-brand">
      <div className="absolute inset-0 grid-pattern opacity-20" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-glow/40 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-background/30 blur-3xl" />

      <div className="relative mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-28">
        <h2 className="mx-auto max-w-3xl font-display text-5xl leading-[0.95] tracking-wide text-primary-foreground sm:text-7xl">
          Your next title shot is one match away
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-primary-foreground/80">
          Join thousands of players battling for prize pools right now.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            asChild
            className="h-12 bg-background px-8 font-display text-lg tracking-[0.12em] text-foreground hover:bg-background/90"
          >
            <Link to="/register">
              Create Account
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            asChild
            className="h-12 border-primary-foreground/40 bg-transparent px-8 font-display text-lg tracking-[0.12em] text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link to="/games">Browse Games</Link>
          </Button>
        </div>
        <div className="mt-7 font-display text-xs tracking-[0.24em] text-primary-foreground/70">
          No download required · Cross-platform · Skill-based matchmaking
        </div>
      </div>
    </section>
  );
}

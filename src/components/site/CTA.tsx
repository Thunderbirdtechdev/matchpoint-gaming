import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="relative py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-card p-10 text-center shadow-elevated md:p-16">
          <div className="absolute inset-0 grid-pattern opacity-30" />
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-secondary/30 blur-3xl" />

          <div className="relative">
            <h2 className="font-display text-balance text-4xl font-black uppercase tracking-tight sm:text-6xl">
              Your next title shot is{" "}
              <span className="text-gradient-gold">one match away</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Join thousands of players battling for prize pools right now.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground glow-primary hover:opacity-95" asChild>
                <Link to="/register">
                  Create Account
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-border/80 bg-surface/40 hover:bg-surface" asChild>
                <Link to="/tournaments">Browse Competitions</Link>
              </Button>
            </div>
            <div className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              No download required · Cross-platform · Skill-based matchmaking
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

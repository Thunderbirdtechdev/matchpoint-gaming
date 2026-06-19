import { Trophy } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-brand">
              <Trophy className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">
              Match<span className="text-gradient-brand">Point</span>
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} MatchPoint. Play. Compete. Win.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

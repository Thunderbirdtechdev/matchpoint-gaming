import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — MatchPoint" },
      { name: "description", content: "Reset your MatchPoint password by email." },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <Link to="/" className="mx-auto flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-brand glow-primary">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">
            Match<span className="text-gradient-brand">Point</span>
          </span>
        </Link>

        <div className="mt-10 rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-elevated">
          <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We'll send a reset link to your email.
          </p>

          <form className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <Button className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
              Send reset link
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-foreground hover:text-primary">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

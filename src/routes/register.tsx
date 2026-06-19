import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — MatchPoint" },
      { name: "description", content: "Create a free MatchPoint account to challenge players, enter tournaments and earn rewards." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-secondary/20 blur-3xl" />

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
          <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free forever. No credit card required.</p>

          <form className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="ProGamer123" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
            <Button className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90">
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-foreground hover:text-primary">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

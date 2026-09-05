import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/site/AuthShell";
import { MfaChallenge } from "@/components/security/MfaChallenge";
import { needsMfaChallenge } from "@/lib/mfa";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in | MatchPoint" },
      { name: "description", content: "Sign in to your MatchPoint account to play, compete and track winnings." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(false);

  /**
   * The redirect has to yield to a pending challenge. `signInWithPassword`
   * populates `user` at AAL1, so without this guard the effect fires and
   * navigates away before the code can be entered — which is the bug that made
   * two-factor unenforceable in the first place.
   *
   * `user && !challenge` also covers arriving here with a session already in
   * hand: the check below runs first and only sets `challenge` when one is
   * genuinely owed, so an already-elevated session redirects as it always did.
   */
  useEffect(() => {
    if (user && !challenge) navigate({ to: "/dashboard" });
  }, [user, challenge, navigate]);

  /**
   * Resume rather than skip. A reload during the challenge leaves a valid AAL1
   * session behind, and without this the page would treat it as done.
   */
  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    void needsMfaChallenge().then((owed) => {
      if (!cancelled && owed) setChallenge(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }

    // Ask before celebrating. An account with a factor is not finished signing
    // in yet, and "Signed in" followed by a code prompt reads as a failure.
    const owed = await needsMfaChallenge();
    setLoading(false);
    if (owed) return setChallenge(true);

    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  }

  if (challenge) {
    return (
      <AuthShell title="One more step" subtitle="Enter the code from your authenticator app.">
        <MfaChallenge
          onVerified={() => {
            toast.success("Signed in");
            setChallenge(false);
            navigate({ to: "/dashboard" });
          }}
          onCancel={() => {
            setChallenge(false);
            navigate({ to: "/dashboard" });
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep competing."
      footer={
        <span className="text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="font-semibold text-foreground hover:text-primary">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleEmail} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
        </Button>
      </form>
    </AuthShell>
  );
}

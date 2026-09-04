import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/site/AuthShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { linkReferral } from "@/lib/promo.functions";
import { toast } from "sonner";

type SearchParams = { ref?: string };

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — MatchPoint" },
      { name: "description", content: "Create a free MatchPoint account to challenge players, enter tournaments and earn rewards." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const search = useSearch({ from: "/register" });
  const linkReferralSF = useServerFn(linkReferral);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { username, display_name: username },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    if (search.ref) {
      try {
        await linkReferralSF({ data: { referrer_username: search.ref } });
      } catch {
        // Non-critical — a referral link failing to attach shouldn't block signup.
      }
    }

    toast.success("Account created! Check your email if confirmation is required.");
    navigate({ to: "/dashboard" });
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free forever. No credit card required."
      footer={
        <span className="text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-foreground hover:text-primary">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            required
            minLength={3}
            maxLength={32}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ProGamer123"
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
        </Button>
      </form>
    </AuthShell>
  );
}

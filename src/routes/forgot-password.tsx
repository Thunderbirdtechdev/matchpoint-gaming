import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BackgroundPattern } from "@/components/ui/tailwind-css-background-snippet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — MatchPoint" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Check your email for the reset link.");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <BackgroundPattern />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6">
        <Link to="/" className="mx-auto flex items-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-brand"><Trophy className="h-5 w-5 text-primary-foreground" /></div>
          <span className="text-xl font-bold">Match<span className="text-gradient-brand">Point</span></span>
        </Link>
        <div className="mt-10 rounded-2xl border border-border/60 bg-gradient-card p-8 shadow-elevated">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">We'll send you a link to choose a new one.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-gradient-brand text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send reset link"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

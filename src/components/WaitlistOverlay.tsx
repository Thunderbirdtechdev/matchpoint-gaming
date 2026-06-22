import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Swords, Coins, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { joinWaitlist } from "@/lib/waitlist.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";

const STORAGE_KEY = "mp_waitlist_joined";

export function WaitlistOverlay() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");

  const submit = useServerFn(joinWaitlist);
  const m = useMutation({
    mutationFn: async (e: string) =>
      submit({
        data: {
          email: e,
          source: "overlay",
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        },
      }),
    onSuccess: () => {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
      setJoined(true);
      toast.success("You're on the list!");
    },
    onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
  });

  // Hydrate localStorage flag once on the client.
  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setJoined(true);
    } catch {}
  }, []);

  // Check admin role so the team can keep using the app.
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Don't render until we know auth state — avoids a flash for admins.
  if (!mounted || loading || isAdmin === null) return null;
  if (isAdmin) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
      className="fixed inset-0 z-[9999] overflow-y-auto bg-[#05070d]"
    >
      {/* Backdrop glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.25),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(124,58,237,0.2),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-5 py-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3 w-3" />
          Launching soon
        </span>

        <h1
          id="waitlist-title"
          className="mt-5 font-[Orbitron,Rajdhani,sans-serif] text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
            MatchPoint Gaming
          </span>
        </h1>

        <p className="mt-3 max-w-xl text-sm text-white/70 sm:text-base">
          The skill-based competitive gaming platform where players go head-to-head
          for real prize pools. Tournaments, 1v1 challenges, fair-play escrow, and
          instant payouts — all in one arena.
        </p>

        {/* Features */}
        <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
          <Feature icon={<Trophy className="h-4 w-4" />} title="Tournaments" sub="Daily brackets" />
          <Feature icon={<Swords className="h-4 w-4" />} title="1v1 Challenges" sub="Wager & win" />
          <Feature icon={<Coins className="h-4 w-4" />} title="Real Payouts" sub="Stripe & crypto" />
          <Feature icon={<ShieldCheck className="h-4 w-4" />} title="Fair Escrow" sub="Funds protected" />
        </div>

        {/* Form / success */}
        <div className="mt-9 w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md shadow-[0_20px_60px_-20px_rgba(37,99,235,0.45)]">
          {joined ? (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <div className="rounded-full bg-emerald-500/15 p-2 text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-white">You're on the list.</p>
              <p className="text-xs text-white/60">
                We'll email you the moment we're cleared for take-off. Keep an eye on your
                inbox — early signups get priority access and entry-fee credits.
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = email.trim().toLowerCase();
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                  toast.error("Enter a valid email address");
                  return;
                }
                m.mutate(trimmed);
              }}
              className="space-y-3"
            >
              <label className="block text-left text-xs font-medium uppercase tracking-wider text-white/60">
                Get notified at launch
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-white/15 bg-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary"
                  disabled={m.isPending}
                />
                <Button
                  type="submit"
                  disabled={m.isPending}
                  className="h-11 shrink-0 bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold text-white hover:opacity-95"
                >
                  {m.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Join the waitlist"
                  )}
                </Button>
              </div>
              <p className="text-left text-[11px] text-white/45">
                One email at launch. No spam, ever. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-white/40">
          <span>Secure escrow holds</span>
          <span aria-hidden>·</span>
          <span>Stripe &amp; crypto payouts</span>
          <span aria-hidden>·</span>
          <span>18+ · Play responsibly</span>
        </div>

        <footer className="mt-10 text-[11px] text-white/35">
          <a href="/terms" className="text-white/60 underline-offset-2 hover:underline">Terms</a>
          <span className="mx-2" aria-hidden>·</span>
          <a href="/privacy" className="text-white/60 underline-offset-2 hover:underline">Privacy</a>
        </footer>
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-left">
      <div className="flex items-center gap-2 text-primary">
        {icon}
        <span className="text-[13px] font-semibold text-white">{title}</span>
      </div>
      <p className="mt-1 text-[11px] text-white/50">{sub}</p>
    </div>
  );
}

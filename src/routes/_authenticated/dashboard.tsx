import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Trophy, Swords, Wallet, TrendingUp, Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useServerFn } from "@tanstack/react-start";
import { getMyWallet } from "@/lib/wallet.functions";
import { MIN_DEPOSIT_USD, MIN_ENTRY_USD } from "@/lib/fees";

/** The shape getMyWallet returns, so FirstRun can take it as a prop. */
type WalletSummary = Awaited<ReturnType<typeof getMyWallet>>;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard | MatchPoint" }] }),
  component: DashboardPage,
});

/**
 * Module 11 — placeholder rows while a list loads.
 *
 * Every list on this page used `data?.length ? ... : <empty state>`, and
 * `data` is undefined until the query resolves. So the first thing a returning
 * player saw was "No matches yet. Create a challenge to get started." — for as
 * long as the request took, which on a phone is seconds.
 *
 * That is the same failure Module 8 called out for the revenue chart: an empty
 * state rendered during loading is not imprecise, it is false. It tells a
 * player with five active matches that they have none.
 */
function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * What to do first, for a player who has just signed up.
 *
 * The dashboard greeted a new account with four zeroed stats and three empty
 * lists — accurate, and no help at all. Players were signing up and not
 * depositing, and "I didn't know what to do next" is the likeliest reason a
 * funnel stops exactly there.
 *
 * Driven by state rather than dismissal: each step reads whether the thing has
 * actually happened, so the card retires itself when the player is going and
 * cannot be closed while a step is still outstanding. Nothing is stored, and a
 * player who deposits and then withdraws everything does not get told to start
 * over — `has_played` and a connected payout account both stay true.
 */
function FirstRun({ data }: { data: WalletSummary | undefined }) {
  if (!data) return null;

  const availableCents = data.balances?.available_cents ?? 0;
  const hasDeposited = data.transactions.some(
    (t) => t.type === "deposit" && t.status === "completed",
  );
  /*
   * Funded means "can actually enter a match", not "balance above zero".
   *
   * ensure_wallet credits a $5 welcome bonus the first time a wallet is
   * created, so `> 0` was true for every account that had merely loaded this
   * page — the checklist congratulated people for money the platform had just
   * given them, and struck through "Add funds to your wallet" on an empty one.
   *
   * Since the welcome bonus is exactly the minimum entry, a new player really
   * can play without depositing. That makes the first step genuinely complete,
   * which is why this checks the entry floor rather than a deposit: the goal is
   * getting them into a match, not taking their money first.
   */
  const canEnterAMatch = availableCents >= MIN_ENTRY_USD * 100;
  const funded = hasDeposited || canEnterAMatch;

  const steps = [
    {
      done: funded,
      title: funded ? "Wallet funded" : "Add funds to your wallet",
      blurb: `You need at least $${MIN_ENTRY_USD} to enter a match. Deposits start at $${MIN_DEPOSIT_USD}.`,
      to: "/wallet" as const,
      cta: "Add funds",
    },
    {
      done: data.has_played,
      title: "Play your first match",
      blurb:
        !hasDeposited && canEnterAMatch
          ? "Your welcome credit covers an entry, so you can play without depositing anything."
          : "Take on an open challenge, or post your own and let someone accept it.",
      to: "/marketplace" as const,
      cta: "Find a match",
    },
    {
      done: Boolean(data.connect?.payouts_enabled),
      title: "Set up payouts",
      blurb: "Connect your bank so your winnings can reach it. Standard cash-outs are free.",
      to: "/wallet" as const,
      cta: "Set up",
    },
  ];

  // Retired once they are up and running.
  if (steps.every((s) => s.done)) return null;

  const next = steps.findIndex((s) => !s.done);

  return (
    <section className="mb-8 rounded-2xl border border-primary/30 bg-gradient-card p-6">
      <h2 className="font-semibold">Getting started</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Three steps and you are playing for real money.
      </p>

      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3">
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
                  i === next
                    ? "border-primary text-primary"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}
              >
                {s.title}
              </div>
              {!s.done && <div className="mt-0.5 text-xs text-muted-foreground">{s.blurb}</div>}
            </div>
            {/* Only the next step gets a button. Three buttons is a menu to
                choose from; one is an instruction. */}
            {i === next && (
              <Button asChild size="sm" className="shrink-0">
                <Link to={s.to}>{s.cta}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function DashboardPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: myChallenges, isPending: myChallengesLoading } = useQuery({
    queryKey: ["my-challenges", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("challenges")
          .select("*")
          .or(`creator_id.eq.${user!.id},opponent_id.eq.${user!.id}`)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data ?? [],
  });

  const { data: openChallenges, isPending: openChallengesLoading } = useQuery({
    queryKey: ["open-challenges"],
    queryFn: async () =>
      (
        await supabase
          .from("challenges")
          .select("*")
          .eq("status", "open")
          // Same reasoning as the marketplace: a private challenge belongs to
          // one player and is not "open" to this list.
          .is("invited_user_id", null)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data ?? [],
  });

  const { data: upcoming, isPending: upcomingLoading } = useQuery({
    queryKey: ["upcoming-tournaments"],
    queryFn: async () =>
      (
        await supabase
          .from("tournaments")
          .select("*")
          .eq("status", "upcoming")
          .order("starts_at")
          .limit(4)
      ).data ?? [],
  });

  /*
   * One source for the balance, not two.
   *
   * The stat below read `wallets` directly while the checklist read
   * getMyWallet, and getMyWallet is what calls ensure_wallet — which creates
   * the row and credits the welcome bonus. So on a brand-new account the raw
   * query got there first and reported $0.00 while the checklist saw $5.00.
   * Both now read the same answer, after the wallet exists.
   */
  const walletFn = useServerFn(getMyWallet);
  const { data: walletData } = useQuery({
    queryKey: ["wallet-summary", user?.id],
    enabled: !!user,
    queryFn: () => walletFn(),
  });

  const stats = [
    { label: "Reputation", value: profile?.reputation ?? 100, icon: TrendingUp },
    { label: "XP", value: profile?.xp ?? 0, icon: Trophy },
    {
      label: "Active matches",
      value: myChallenges?.filter((c) => c.status === "active").length ?? 0,
      icon: Swords,
    },
    {
      label: "Wallet",
      value: `$${((walletData?.balances?.available_cents ?? 0) / 100).toFixed(2)}`,
      icon: Wallet,
    },
  ];

  return (
    <DashboardShell
      title={`Welcome, ${profile?.display_name ?? "Player"}`}
      subtitle={`Rank: ${profile?.rank_tier ?? "Bronze"}`}
    >
      <FirstRun data={walletData} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-gradient-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs uppercase tracking-wider">{s.label}</span>
              <s.icon className="h-4 w-4" />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Your recent matches</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/challenges">View all</Link>
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {myChallengesLoading ? (
              <ListSkeleton />
            ) : myChallenges?.length ? (
              myChallenges.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 text-sm"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {c.game_slug} · {c.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ${Number(c.entry_amount).toFixed(2)} pool
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium capitalize text-primary">
                    {c.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No matches yet. Create a challenge to get started.
              </p>
            )}
            <Button asChild className="mt-3 w-full bg-gradient-brand text-primary-foreground">
              <Link to="/challenges">
                <Plus className="mr-2 h-4 w-4" />
                New challenge
              </Link>
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6">
          <h2 className="font-semibold">Open challenges</h2>
          <div className="mt-4 space-y-2">
            {openChallengesLoading ? (
              <ListSkeleton />
            ) : openChallenges?.length ? (
              openChallenges.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-surface/50 p-3 text-sm"
                >
                  <div>
                    <div className="font-medium capitalize">
                      {c.game_slug} · {c.platform}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.rules?.slice(0, 60) ?? "Standard rules"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-accent">
                      ${Number(c.entry_amount).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No open challenges right now.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-gradient-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Upcoming tournaments</h2>
            <Button asChild size="sm" variant="ghost">
              <Link to="/my-tournaments">My tournaments</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {upcomingLoading ? (
              <ListSkeleton rows={2} />
            ) : upcoming?.length ? (
              upcoming.map((t) => (
                <div key={t.id} className="rounded-xl border border-border/50 bg-surface/50 p-4">
                  <div className="text-sm font-semibold">{t.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground capitalize">
                    {t.game_slug} · {t.platform}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(t.starts_at).toLocaleDateString()}
                    </span>
                    <span className="font-bold text-accent">
                      ${Number(t.prize_pool).toFixed(0)} pool
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming tournaments. Host one!</p>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

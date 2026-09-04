import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Swords, Trophy } from "lucide-react";
import { SearchIcon, type AnimatedIconHandle } from "@/components/ui/animated-icons";
import { IconTile } from "@/components/ui/icon-tile";
import { toast } from "sonner";

import { SiteShell } from "@/components/site/SiteShell";
import { PageHeader } from "@/components/site/PageHeader";
import { CTA } from "@/components/site/CTA";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { acceptChallenge, joinTournament } from "@/lib/matches.functions";
import { SUPPORTED_GAMES, GAME_LABELS, type SupportedGame } from "@/lib/fees";
import { FilterChips, type ChipOption } from "@/components/marketplace/FilterChips";
import { ListingCard, type ListingProfile } from "@/components/marketplace/ListingCard";
import {
  challengeToListing,
  tournamentToListing,
  STAKE_BANDS,
  type Listing,
  type ListingKind,
  type StakeBandId,
} from "@/components/marketplace/listing";
import headerImg from "@/assets/hero-bg.jpg";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Find Your Next Match | MatchPoint" },
      {
        name: "description",
        content:
          "Browse live 1v1 challenges and open tournaments across Fortnite, NBA 2K27, Madden NFL 27, NCAA 27 and MLB The Show 26. Filter by game, platform and stake, then play for real money.",
      },
      { property: "og:title", content: "Marketplace — Find Your Next Match | MatchPoint" },
      {
        property: "og:description",
        content: "Live 1v1 challenges and open tournaments with real cash prizes.",
      },
      { property: "og:url", content: "https://matchpointgaming.org/marketplace" },
    ],
    links: [{ rel: "canonical", href: "https://matchpointgaming.org/marketplace" }],
  }),
  component: MarketplacePage,
});

const PLATFORMS = ["PC", "PlayStation", "Xbox", "Switch"];

const SORTS = [
  { id: "default", label: "" },
  { id: "prize-desc", label: "Prize: high to low" },
  { id: "prize-asc", label: "Prize: low to high" },
  { id: "entry-asc", label: "Entry: low to high" },
];

type FilterState = {
  games: Set<string>;
  platforms: Set<string>;
  band: StakeBandId;
  query: string;
};

/** Does a listing survive the filters? `skip` excludes one facet so it can count itself. */
function passes(l: Listing, f: FilterState, skip?: "games" | "platforms"): boolean {
  if (skip !== "games" && f.games.size > 0 && !f.games.has(l.game)) return false;
  if (skip !== "platforms" && f.platforms.size > 0 && !f.platforms.has(l.platform)) return false;

  const band = STAKE_BANDS.find((b) => b.id === f.band) ?? STAKE_BANDS[0];
  if (l.entry < band.min || l.entry > band.max) return false;

  const q = f.query.trim().toLowerCase();
  if (q) {
    const label = GAME_LABELS[l.game as SupportedGame] ?? l.game;
    if (!`${l.title} ${label} ${l.platform}`.toLowerCase().includes(q)) return false;
  }
  return true;
}

function MarketplacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const acceptFn = useServerFn(acceptChallenge);
  const joinFn = useServerFn(joinTournament);

  const [tab, setTab] = useState<ListingKind>("challenge");
  const [games, setGames] = useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = useState<Set<string>>(new Set());
  const [band, setBand] = useState<StakeBandId>("any");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("default");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const emptyIconRef = useRef<AnimatedIconHandle>(null);

  /* ── Data ── */

  const challengesQuery = useQuery({
    queryKey: ["marketplace", "challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("status", "open")
        // Private challenges are addressed to one player and must not appear
        // here. The real enforcement is in acceptChallenge; this keeps them
        // out of sight.
        .is("invited_user_id", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tournamentsQuery = useQuery({
    queryKey: ["marketplace", "tournaments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .in("status", ["upcoming", "open"])
        .order("starts_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const entryCountsQuery = useQuery({
    queryKey: ["marketplace", "entry-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tournament_entries").select("tournament_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.tournament_id] = (counts[row.tournament_id] ?? 0) + 1;
      }
      return counts;
    },
  });

  const challenges = useMemo(
    () => (challengesQuery.data ?? []).map(challengeToListing),
    [challengesQuery.data],
  );
  const tournaments = useMemo(
    () =>
      (tournamentsQuery.data ?? []).map((t) =>
        tournamentToListing(t, entryCountsQuery.data?.[t.id] ?? 0),
      ),
    [tournamentsQuery.data, entryCountsQuery.data],
  );

  // Host profiles are fetched separately — challenges/tournaments FK to auth.users, not profiles.
  const hostIds = useMemo(
    () => [...new Set([...challenges, ...tournaments].map((l) => l.hostId))].sort(),
    [challenges, tournaments],
  );

  const hostsQuery = useQuery({
    queryKey: ["marketplace", "hosts", hostIds],
    enabled: hostIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, rank_tier")
        .in("id", hostIds);
      if (error) throw error;
      const map: Record<string, ListingProfile> = {};
      for (const p of data ?? []) map[p.id] = p;
      return map;
    },
  });

  /* ── Filtering ── */

  const base = tab === "challenge" ? challenges : tournaments;
  const filters: FilterState = { games, platforms, band, query };

  const gameOptions: ChipOption[] = SUPPORTED_GAMES.map((g) => ({
    id: g,
    label: GAME_LABELS[g],
    count: base.filter((l) => l.game === g && passes(l, filters, "games")).length,
  }));

  const platformOptions: ChipOption[] = PLATFORMS.map((p) => ({
    id: p,
    label: p,
    count: base.filter((l) => l.platform === p && passes(l, filters, "platforms")).length,
  }));

  const visible = useMemo(() => {
    const out = base.filter((l) => passes(l, filters));
    switch (sort) {
      case "prize-desc":
        out.sort((a, b) => b.prize - a.prize);
        break;
      case "prize-asc":
        out.sort((a, b) => a.prize - b.prize);
        break;
      case "entry-asc":
        out.sort((a, b) => a.entry - b.entry);
        break;
      default:
        out.sort((a, b) =>
          tab === "challenge"
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime(),
        );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, games, platforms, band, query, sort, tab]);

  const loading =
    tab === "challenge"
      ? challengesQuery.isLoading
      : tournamentsQuery.isLoading || entryCountsQuery.isLoading;

  const hasFilters = games.size > 0 || platforms.size > 0 || band !== "any" || query.trim() !== "";

  function clearAll() {
    setGames(new Set());
    setPlatforms(new Set());
    setBand("any");
    setQuery("");
  }

  function toggle(setter: typeof setGames) {
    return (id: string) =>
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
  }

  /* ── Actions ── */

  async function onAction(l: Listing) {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    setPendingId(l.id);
    try {
      if (l.kind === "challenge") {
        await acceptFn({ data: { challenge_id: l.id } });
        toast.success("Challenge accepted — your stake is in escrow. GL!");
      } else {
        await joinFn({ data: { tournament_id: l.id } });
        toast.success("You're in — your entry is held in escrow.");
      }
      qc.invalidateQueries({ queryKey: ["marketplace"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <SiteShell>
      <PageHeader
        eyebrow="Marketplace"
        title={
          <>
            Find your next <span className="text-gradient-brand">match</span>.
          </>
        }
        description="Every open 1v1 challenge and tournament on MatchPoint, in one place. Filter by game, platform and stake — then put your skills where your money is."
        image={{ src: headerImg, alt: "MatchPoint competitive arena" }}
      />

      <section className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20">
        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as ListingKind)}>
          <TabsList className="h-auto bg-surface/50 p-1">
            <TabsTrigger
              value="challenge"
              className="gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Swords className="h-3.5 w-3.5" />
              1v1 Challenges
              <span className="text-muted-foreground">({challenges.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="tournament"
              className="gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Trophy className="h-3.5 w-3.5" />
              Tournaments
              <span className="text-muted-foreground">({tournaments.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filter panel */}
        <div className="mt-6 space-y-5 rounded-2xl border border-border/60 bg-surface/30 p-5 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by rules, title, game or platform…"
                className="pl-9"
              />
            </div>
            <Select value={band} onValueChange={(v) => setBand(v as StakeBandId)}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAKE_BANDS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label || (tab === "challenge" ? "Newest first" : "Starting soonest")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FilterChips
              label="Game"
              options={gameOptions}
              active={games}
              onToggle={toggle(setGames)}
              onClear={() => setGames(new Set())}
            />
            <FilterChips
              label="Platform"
              options={platformOptions}
              active={platforms}
              onToggle={toggle(setPlatforms)}
              onClear={() => setPlatforms(new Set())}
            />
          </div>
        </div>

        {/* Result meta */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${visible.length} ${visible.length === 1 ? "result" : "results"}`}
          </p>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs">
              Clear all filters
            </Button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-border/50">
                <Skeleton className="aspect-[16/9] w-full rounded-none" />
                <div className="space-y-3 p-4">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                host={hostsQuery.data?.[l.hostId]}
                isOwn={!!user && l.hostId === user.id}
                isSignedIn={!!user}
                pending={pendingId === l.id}
                onAction={onAction}
              />
            ))}
          </div>
        ) : (
          <div
            className="mt-4 grid place-items-center rounded-2xl border border-dashed border-border/60 bg-surface/20 px-6 py-20 text-center"
            onMouseEnter={() => emptyIconRef.current?.startAnimation()}
            onMouseLeave={() => emptyIconRef.current?.stopAnimation()}
          >
            <IconTile size="lg">
              <SearchIcon ref={emptyIconRef} size={20} />
            </IconTile>
            <h3 className="mt-4 font-display text-xl tracking-wide">
              {hasFilters ? "Nothing matches those filters" : "Nothing open right now"}
            </h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {hasFilters
                ? "Try widening your stake range or clearing a game filter."
                : tab === "challenge"
                  ? "Be the first to post a challenge and let someone come to you."
                  : "No tournaments are open for entry yet — check back soon."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              )}
              <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground">
                <Link to={user ? "/challenges" : "/register"}>
                  {user ? "Create a challenge" : "Create an account"}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <CTA />
    </SiteShell>
  );
}

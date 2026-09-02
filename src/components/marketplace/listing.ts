import { calculateChallengeFee, calculateTournamentFee } from "@/lib/fees";

export type ListingKind = "challenge" | "tournament";

/** A challenge or a tournament flattened into one shape the grid can filter and sort. */
export type Listing = {
  id: string;
  kind: ListingKind;
  game: string;
  platform: string;
  /** What a player pays to enter. */
  entry: number;
  /** What the winner walks away with, net of platform fees. */
  prize: number;
  title: string;
  hostId: string;
  createdAt: string;
  startsAt: string | null;
  players: number;
  maxPlayers: number | null;
  format: string | null;
};

type ChallengeRow = {
  id: string;
  creator_id: string;
  game_slug: string;
  platform: string;
  entry_amount: number | string;
  rules: string | null;
  created_at: string;
};

type TournamentRow = {
  id: string;
  host_id: string;
  title: string;
  game_slug: string;
  platform: string;
  format: string;
  max_players: number;
  entry_fee: number | string;
  prize_pool: number | string;
  starts_at: string;
  created_at: string;
};

export function challengeToListing(c: ChallengeRow): Listing {
  const entry = Number(c.entry_amount);
  return {
    id: c.id,
    kind: "challenge",
    game: c.game_slug,
    platform: c.platform,
    entry,
    prize: calculateChallengeFee(entry).netPrize,
    title: c.rules?.trim() || "Standard rules",
    hostId: c.creator_id,
    createdAt: c.created_at,
    startsAt: null,
    players: 1,
    maxPlayers: 2,
    format: null,
  };
}

export function tournamentToListing(t: TournamentRow, players: number): Listing {
  const entry = Number(t.entry_fee);
  const declaredPool = Number(t.prize_pool);
  const prize =
    declaredPool > 0 ? declaredPool : calculateTournamentFee(entry, t.max_players).netPrize;
  return {
    id: t.id,
    kind: "tournament",
    game: t.game_slug,
    platform: t.platform,
    entry,
    prize,
    title: t.title,
    hostId: t.host_id,
    createdAt: t.created_at,
    startsAt: t.starts_at,
    players,
    maxPlayers: t.max_players,
    format: t.format,
  };
}

export const FORMAT_LABELS: Record<string, string> = {
  single_elim: "Single elimination",
  double_elim: "Double elimination",
  round_robin: "Round robin",
};

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function startsIn(iso: string): string {
  const seconds = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return "Starting now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Starts in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Starts in ${hours}h`;
  return `Starts in ${Math.floor(hours / 24)}d`;
}

/** Stake brackets offered in the filter bar. */
export const STAKE_BANDS = [
  { id: "any", label: "Any stake", min: 0, max: Infinity },
  { id: "10-25", label: "$10 – $25", min: 10, max: 25 },
  { id: "25-50", label: "$25 – $50", min: 25, max: 50 },
  { id: "50-100", label: "$50 – $100", min: 50, max: 100 },
  { id: "100+", label: "$100+", min: 100, max: Infinity },
] as const;

export type StakeBandId = (typeof STAKE_BANDS)[number]["id"];

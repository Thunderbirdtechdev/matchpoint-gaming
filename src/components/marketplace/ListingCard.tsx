import { Link } from "@tanstack/react-router";
import { Swords, Trophy, Users, Loader2 } from "lucide-react";
import { PremiumCard } from "@/components/ui/premium-card";
import { Status } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GAME_LABELS, type SupportedGame } from "@/lib/fees";
import { gameArt } from "@/lib/game-art";
import { FORMAT_LABELS, startsIn, timeAgo, type Listing } from "./listing";

export type ListingProfile = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  rank_tier: string | null;
};

export function ListingCard({
  listing,
  host,
  isOwn,
  isSignedIn,
  pending,
  onAction,
}: {
  listing: Listing;
  host?: ListingProfile;
  isOwn: boolean;
  isSignedIn: boolean;
  pending: boolean;
  onAction: (listing: Listing) => void;
}) {
  const isChallenge = listing.kind === "challenge";
  const gameLabel = GAME_LABELS[listing.game as SupportedGame] ?? listing.game;
  const hostName = host?.display_name || host?.username || "Anonymous";
  const initials = hostName.slice(0, 2).toUpperCase();
  const full = !isChallenge && listing.maxPlayers !== null && listing.players >= listing.maxPlayers;
  const filled = listing.maxPlayers ? Math.round((listing.players / listing.maxPlayers) * 100) : 0;

  const actionLabel = !isSignedIn
    ? "Sign in to play"
    : isOwn
      ? "Your listing"
      : full
        ? "Full"
        : isChallenge
          ? "Accept"
          : "Join";

  return (
    <PremiumCard>
      {/* Cover art */}
      <div className="relative aspect-[16/9] shrink-0 overflow-hidden rounded-t-[11px]">
        <img
          src={gameArt(listing.game)}
          alt={gameLabel}
          loading="lazy"
          width={640}
          height={360}
          className="h-full w-full object-cover object-[center_30%] transition-transform duration-500 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 img-scrim" />
        <Status
          variant="brandSolid"
          className="absolute bottom-2 left-3 px-2 py-0.5 text-[10px] uppercase tracking-wider"
        >
          {gameLabel}
        </Status>
        <Status
          variant="glass"
          className="absolute right-3 top-3 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
        >
          {isChallenge ? <Swords /> : <Trophy />}
          {isChallenge ? "1v1" : "Tournament"}
        </Status>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        {isChallenge ? (
          <Link
            to="/match/$id"
            params={{ id: listing.id }}
            className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary-glow"
          >
            {listing.title}
          </Link>
        ) : (
          <Link
            to="/tournament/$id"
            params={{ id: listing.id }}
            className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary-glow"
          >
            {listing.title}
          </Link>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={host?.avatar_url ?? undefined} alt="" />
            <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary-glow">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-xs text-muted-foreground">
            {hostName}
            {host?.rank_tier && (
              <span className="ml-1.5 text-primary-glow">· {host.rank_tier}</span>
            )}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>{listing.platform}</span>
          <span className="opacity-40">•</span>
          <span>{isChallenge ? timeAgo(listing.createdAt) : startsIn(listing.startsAt!)}</span>
          {listing.format && (
            <>
              <span className="opacity-40">•</span>
              <span>{FORMAT_LABELS[listing.format] ?? listing.format}</span>
            </>
          )}
        </div>

        {!isChallenge && listing.maxPlayers !== null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {listing.players}/{listing.maxPlayers} players
              </span>
              <span>{filled}% full</span>
            </div>
            <Progress value={filled} className="mt-1.5 h-1.5" />
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="text-lg font-bold text-accent">${listing.prize.toFixed(2)}</div>
            <div className="text-[11px] text-muted-foreground">
              {isChallenge ? "Winner takes" : "Prize pool"} · Entry ${listing.entry.toFixed(0)}
            </div>
          </div>
          <Button
            size="sm"
            disabled={pending || (isSignedIn && (isOwn || full))}
            onClick={() => onAction(listing)}
            className="bg-gradient-brand text-xs font-bold uppercase tracking-wider text-primary-foreground transition-shadow duration-300 hover:opacity-90 group-hover:shadow-[0_0_20px_oklch(0.51_0.23_277_/_0.25)]"
          >
            {pending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {actionLabel}
          </Button>
        </div>
      </div>
    </PremiumCard>
  );
}

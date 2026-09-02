import { Link } from "@tanstack/react-router";
import { Crown, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Status } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export type BracketMatch = {
  id: string | null;
  round: number | null;
  slot: number | null;
  status: string | null;
  winner_id: string | null;
  player1_id: string | null;
  player1_name: string | null;
  player1_username: string | null;
  player1_avatar: string | null;
  player2_id: string | null;
  player2_name: string | null;
  player2_username: string | null;
  player2_avatar: string | null;
};

function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round ${round}`;
}

function Seat({
  id,
  name,
  username,
  avatar,
  isWinner,
  decided,
  onPick,
}: {
  id: string | null;
  name: string | null;
  username: string | null;
  avatar: string | null;
  isWinner: boolean;
  decided: boolean;
  onPick?: () => void;
}) {
  const label = name || username || (id ? "Player" : "—");
  const initials = (name || username || "?").slice(0, 2).toUpperCase();

  const body = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors",
        isWinner && "bg-primary/15",
        decided && !isWinner && "opacity-45",
        !id && "opacity-35",
      )}
    >
      <Avatar className="h-6 w-6 shrink-0 ring-1 ring-inset ring-white/10">
        <AvatarImage src={avatar ?? undefined} alt="" />
        <AvatarFallback className="bg-gradient-to-b from-[oklch(0.27_0.062_285)] to-[oklch(0.195_0.048_285)] text-[10px] font-bold text-primary-glow">
          {initials}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 truncate text-xs font-medium">{label}</span>
      {isWinner && <Crown className="h-3.5 w-3.5 shrink-0 text-accent" />}
    </div>
  );

  if (onPick && id) {
    return (
      <button type="button" onClick={onPick} className="w-full text-left hover:bg-surface/60">
        {body}
      </button>
    );
  }
  if (id && username) {
    return (
      <Link to="/player/$username" params={{ username }} className="block hover:bg-surface/40">
        {body}
      </Link>
    );
  }
  return body;
}

export function BracketView({
  matches,
  isHost,
  pendingMatchId,
  onReport,
}: {
  matches: BracketMatch[];
  isHost: boolean;
  pendingMatchId?: string | null;
  onReport?: (matchId: string, winnerId: string) => void;
}) {
  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-surface/20 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          The bracket hasn&rsquo;t been generated yet.
        </p>
      </div>
    );
  }

  const totalRounds = Math.max(...matches.map((m) => m.round ?? 1));
  const rounds = Array.from({ length: totalRounds }, (_, i) =>
    matches.filter((m) => m.round === i + 1).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)),
  );

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-5">
        {rounds.map((roundMatches, i) => (
          <div key={i} className="flex min-w-[220px] flex-1 flex-col">
            <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {roundLabel(i + 1, totalRounds)}
            </div>

            {/* Spacing doubles each round so matches line up with their feeders. */}
            <div className="flex flex-1 flex-col justify-around gap-3">
              {roundMatches.map((m) => {
                const decided = m.status === "settled" || m.status === "bye";
                const canReport =
                  isHost && !!onReport && m.status === "ready" && !!m.player1_id && !!m.player2_id;
                const busy = pendingMatchId === m.id;

                return (
                  <div
                    key={m.id ?? `${i}-${m.slot}`}
                    className={cn(
                      "rounded-xl border bg-background/60 p-1.5 transition-colors",
                      decided ? "border-border/40" : "border-border/60",
                      m.status === "ready" && "border-primary/40",
                    )}
                  >
                    <Seat
                      id={m.player1_id}
                      name={m.player1_name}
                      username={m.player1_username}
                      avatar={m.player1_avatar}
                      isWinner={decided && m.winner_id === m.player1_id}
                      decided={decided}
                      onPick={
                        canReport && m.player1_id && m.id && !busy
                          ? () => onReport(m.id!, m.player1_id!)
                          : undefined
                      }
                    />
                    <div className="my-0.5 h-px bg-border/40" />
                    {m.status === "bye" ? (
                      <div className="px-2.5 py-1.5 text-[11px] italic text-muted-foreground">
                        bye
                      </div>
                    ) : (
                      <Seat
                        id={m.player2_id}
                        name={m.player2_name}
                        username={m.player2_username}
                        avatar={m.player2_avatar}
                        isWinner={decided && m.winner_id === m.player2_id}
                        decided={decided}
                        onPick={
                          canReport && m.player2_id && m.id && !busy
                            ? () => onReport(m.id!, m.player2_id!)
                            : undefined
                        }
                      />
                    )}

                    {canReport && (
                      <div className="px-2 pb-1 pt-1.5 text-[10px] text-muted-foreground">
                        {busy ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Reporting…
                          </span>
                        ) : (
                          "Click the winner"
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BracketChampion({
  name,
  username,
  onSettle,
  settling,
  isHost,
}: {
  name: string;
  username: string | null;
  onSettle?: () => void;
  settling?: boolean;
  isHost: boolean;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-5">
      <div className="flex items-center gap-3">
        <Crown className="h-5 w-5 text-accent" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            Champion
          </div>
          <div className="mt-0.5 font-display text-xl tracking-wide">
            {username ? (
              <Link to="/player/$username" params={{ username }} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </div>
        </div>
      </div>

      {isHost && onSettle && (
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={onSettle}
            disabled={settling}
            className="bg-gradient-brand text-primary-foreground"
          >
            {settling && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Release prize money
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Pays out escrow via the existing payout flow
          </span>
        </div>
      )}
      {!isHost && <Status variant="success">Bracket complete</Status>}
    </div>
  );
}

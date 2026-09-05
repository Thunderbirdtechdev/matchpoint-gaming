/**
 * The chat moderation queue.
 *
 * Two lists that answer different questions. **Reported** is what players
 * objected to — harassment, spam, someone being unpleasant — and it is driven
 * by human judgement. **Flagged** is what the scanner noticed, which is almost
 * entirely one thing: somebody proposing to settle a match off the platform.
 *
 * They are separate because they need different attention. A report is a
 * request that somebody look now. A flag is a pattern worth reading through
 * periodically, and most of them will be innocent — "I topped up with PayPal"
 * trips the same rule as "PayPal me instead". Merging the two would bury the
 * reports under the noise.
 *
 * Deleting hides a message from players and leaves it readable here, because a
 * match room is dispute evidence and a moderator destroying it makes the
 * dispute that follows unresolvable.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert, Trash2, VolumeX, Check, Flag } from "lucide-react";
import { toast } from "sonner";

import {
  listChatModerationQueue,
  moderateDeleteMessage,
  moderateDismissReport,
  moderateMuteUser,
} from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";

const MUTE_MINUTES = 60;

export function ChatModerationQueue() {
  const qc = useQueryClient();
  const listFn = useServerFn(listChatModerationQueue);
  const deleteFn = useServerFn(moderateDeleteMessage);
  const dismissFn = useServerFn(moderateDismissReport);
  const muteFn = useServerFn(moderateMuteUser);

  const q = useQuery({
    queryKey: ["chat-moderation"],
    queryFn: () => listFn({ data: {} }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["chat-moderation"] });

  const del = useMutation({
    mutationFn: async (id: string) => deleteFn({ data: { message_id: id } }),
    onSuccess: () => {
      toast.success("Message hidden from players.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => dismissFn({ data: { report_id: id } }),
    onSuccess: () => {
      toast.success("Report dismissed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mute = useMutation({
    mutationFn: async (userId: string) =>
      muteFn({ data: { user_id: userId, minutes: MUTE_MINUTES, reason: "Chat moderation" } }),
    onSuccess: () => {
      toast.success(`Muted for ${MUTE_MINUTES} minutes.`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const reports = q.data?.reports ?? [];
  const flagged = q.data?.flagged ?? [];

  return (
    <div className="mt-6 space-y-8">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Flag className="h-4 w-4" /> Reported by players
          <span className="text-muted-foreground">({reports.length})</span>
        </h3>

        {reports.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-gradient-card p-6 text-center text-sm text-muted-foreground">
            Nothing reported.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reports.map((r) => (
              <li
                key={r.report_id}
                className="rounded-xl border border-border/60 bg-gradient-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{r.author_name}</span>
                  <span>·</span>
                  <span>{r.scope === "match" ? "Match room" : "Community"}</span>
                  {r.match_id && (
                    <>
                      <span>·</span>
                      <Link
                        to="/match/$id"
                        params={{ id: r.match_id }}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        view match
                      </Link>
                    </>
                  )}
                  {r.deleted && <Status variant="warning">Already hidden</Status>}
                </div>

                <p className="mt-2 rounded-lg border border-border/50 bg-surface/40 p-3 text-sm">
                  {r.body}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Reported because: <span className="text-foreground">{r.reason}</span>
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending || r.deleted}
                    onClick={() => del.mutate(r.message_id)}
                  >
                    {del.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Hide message
                  </Button>
                  {r.author_id && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mute.isPending}
                      onClick={() => mute.mutate(r.author_id!)}
                    >
                      <VolumeX className="mr-1.5 h-3.5 w-3.5" />
                      Mute {MUTE_MINUTES}m
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dismiss.isPending}
                    onClick={() => dismiss.mutate(r.report_id)}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-amber-500" /> Mentions off-platform payment
          <span className="text-muted-foreground">({flagged.length})</span>
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Matched automatically. Most will be innocent — someone saying they deposited with PayPal
          trips the same rule as someone asking to be paid there. Read before acting.
        </p>

        {flagged.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border/60 bg-gradient-card p-6 text-center text-sm text-muted-foreground">
            Nothing flagged.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {flagged.map((m) => (
              <li
                key={m.message_id}
                className="rounded-xl border border-border/60 bg-gradient-card p-4"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{m.author_name}</span>
                  <span>·</span>
                  <span>{m.scope === "match" ? "Match room" : "Community"}</span>
                  <span>·</span>
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                </div>

                <p className="mt-2 rounded-lg border border-border/50 bg-surface/40 p-3 text-sm">
                  {m.body}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.flagged.map((f) => (
                    <span
                      key={f}
                      className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-500"
                    >
                      {f.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={del.isPending}
                    onClick={() => del.mutate(m.message_id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Hide message
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mute.isPending}
                    onClick={() => mute.mutate(m.author_id)}
                  >
                    <VolumeX className="mr-1.5 h-3.5 w-3.5" />
                    Mute {MUTE_MINUTES}m
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * One chat room, used for both the global room and a match room.
 *
 * They differ only in who can read them, which is settled by RLS, so the same
 * component serves both. What it has to get right is smaller than it looks:
 * show history, deliver new messages live, and put the off-platform warning in
 * front of the sender at the moment they are about to send one.
 *
 * Realtime is a plain postgres_changes subscription on INSERT. The policy
 * decides what arrives — a player subscribed to the table receives only the
 * rows they could have selected, so the filter is the RLS, not the channel.
 * Falls back to nothing worse than "new messages appear on reload" if the
 * socket cannot connect, which is why the send path refetches rather than
 * relying on the echo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, ShieldAlert, Flag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OffPlatformNotice } from "@/components/safety/OffPlatformNotice";
import { offPlatformWarning, scanForOffPlatform } from "@/lib/chat/scan";
import { listChatMessages, reportChatMessage, sendChatMessage } from "@/lib/chat.functions";

type Props =
  | { scope: "global"; matchId?: undefined; emptyHint?: string }
  | { scope: "match"; matchId: string; emptyHint?: string };

export function ChatRoom({ scope, matchId, emptyHint }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChatMessages);
  const sendFn = useServerFn(sendChatMessage);
  const reportFn = useServerFn(reportChatMessage);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const key = useMemo(() => ["chat", scope, matchId ?? "global"], [scope, matchId]);
  const args = useMemo(
    () =>
      scope === "match"
        ? { scope: "match" as const, match_id: matchId! }
        : { scope: "global" as const },
    [scope, matchId],
  );

  const messagesQ = useQuery({
    queryKey: key,
    queryFn: () => listFn({ data: args }),
  });

  // Live delivery. RLS decides which inserts reach this client, so the channel
  // does not need to know anything about who is allowed where.
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${scope}:${matchId ?? "global"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.new as { scope?: string; match_id?: string | null };
          if (row.scope !== scope) return;
          if (scope === "match" && row.match_id !== matchId) return;
          qc.invalidateQueries({ queryKey: key });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scope, matchId, qc, key]);

  const messages = messagesQ.data ?? [];

  // Pin to the bottom as messages arrive, the way every chat the reader has
  // ever used behaves.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const hits = scanForOffPlatform(draft);
  const warning = offPlatformWarning(hits);

  const sendM = useMutation({
    mutationFn: async () => sendFn({ data: { ...args, body: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reportM = useMutation({
    mutationFn: async (messageId: string) =>
      reportFn({ data: { message_id: messageId, reason: "Reported from chat" } }),
    onSuccess: () => toast.success("Reported. A moderator will take a look."),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-border/60 bg-gradient-card">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messagesQ.isPending ? (
          <>
            <Skeleton className="h-10 w-2/3 rounded-xl" />
            <Skeleton className="h-10 w-1/2 rounded-xl" />
            <Skeleton className="h-10 w-3/5 rounded-xl" />
          </>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {emptyHint ?? "No messages yet. Say hello."}
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className="group max-w-[80%]">
                {!m.mine && (
                  <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                    {m.author_name}
                  </p>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.mine
                      ? "bg-primary/15 text-foreground"
                      : "border border-border/50 bg-surface/50 text-foreground"
                  }`}
                >
                  {m.body}
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {m.flagged.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-500">
                      <ShieldAlert className="h-3 w-3" /> payment mentioned
                    </span>
                  )}
                  {!m.mine && (
                    <button
                      type="button"
                      onClick={() => reportM.mutate(m.id)}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    >
                      <Flag className="h-3 w-3" /> Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {warning && (
          <p className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{warning}</span>
          </p>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) sendM.mutate();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            placeholder="Write a message…"
            aria-label="Message"
          />
          <Button type="submit" disabled={!draft.trim() || sendM.isPending} size="icon">
            {sendM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <OffPlatformNotice variant="compact" className="mt-2" />
      </div>
    </div>
  );
}

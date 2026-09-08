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
import { Loader2, Send, ShieldAlert, Flag, Reply, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OffPlatformNotice } from "@/components/safety/OffPlatformNotice";
import { ChatBubble, ChatBubbleAvatar, ChatBubbleMessage } from "@/components/ui/chat-bubble";
import { speakerColor, speakerInitials } from "@/lib/chat/speaker-color";
import { offPlatformWarning, scanForOffPlatform } from "@/lib/chat/scan";
import { listChatMessages, reportChatMessage, sendChatMessage } from "@/lib/chat.functions";

/**
 * One row from `listChatMessages`, derived from the server function rather than
 * restated here so a change to the payload is a type error at the call site
 * instead of a field that silently reads undefined.
 */
type ChatMessage = Awaited<ReturnType<typeof listChatMessages>>[number];

type Props =
  | { scope: "global"; matchId?: undefined; emptyHint?: string }
  | { scope: "match"; matchId: string; emptyHint?: string };

export function ChatRoom({ scope, matchId, emptyHint }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChatMessages);
  const sendFn = useServerFn(sendChatMessage);
  const reportFn = useServerFn(reportChatMessage);

  const [draft, setDraft] = useState("");
  /** The message being answered, or null when composing a fresh one. */
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Scroll a quoted message back into view.
   *
   * Queried from the DOM rather than held in a ref map: the list is virtual-
   * free and short (60 messages), and a map would have to be pruned on every
   * refetch. A parent older than the window simply is not on screen, which is
   * why this no-ops rather than throwing.
   */
  const jumpTo = (id: string) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary/60", "rounded-xl");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/60", "rounded-xl"), 1200);
  };

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

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  const hits = scanForOffPlatform(draft);
  const warning = offPlatformWarning(hits);

  const sendM = useMutation({
    mutationFn: async () =>
      sendFn({
        data: { ...args, body: draft.trim(), reply_to_id: replyTo?.id },
      }),
    onSuccess: () => {
      setDraft("");
      setReplyTo(null);
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
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
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
          messages.map((m, i) => {
            // Consecutive messages from one person collapse into a run: the
            // name and avatar are drawn once at the top, and the rest are just
            // bubbles. Repeating an identity every line is what made the old
            // list read as a wall.
            const prev = messages[i - 1];
            const startsRun = !prev || prev.author_id !== m.author_id;
            const color = speakerColor(m.author_id);

            return (
              <div
                key={m.id}
                data-msg-id={m.id}
                className={startsRun && i > 0 ? "pt-3" : undefined}
              >
                {/* Avatar and name share the top line, so the column of text
                    starts level with the face beside it. Hanging the name
                    above the whole row left the avatar floating below its own
                    label. */}
                <ChatBubble variant={m.mine ? "sent" : "received"} className="group items-start">
                  {!m.mine && startsRun ? (
                    <ChatBubbleAvatar
                      src={m.author_avatar ?? undefined}
                      fallback={speakerInitials(m.author_name)}
                      // boxShadow rather than Tailwind's `ring-2`: the ring
                      // utility takes its colour from --tw-ring-color, and
                      // driving a framework-internal variable from inline
                      // styles breaks quietly if that internal is ever renamed.
                      style={{ color, boxShadow: `0 0 0 2px ${color}` }}
                    />
                  ) : (
                    <span className="w-8 shrink-0" aria-hidden />
                  )}

                  <div
                    className={`flex min-w-0 max-w-[78%] flex-col ${
                      m.mine ? "items-end" : "items-start"
                    }`}
                  >
                    {startsRun && !m.mine && (
                      <p className="mb-1 text-[11px] font-semibold" style={{ color }}>
                        {m.author_name}
                      </p>
                    )}

                    <ChatBubbleMessage
                      variant={m.mine ? "sent" : "received"}
                      className="break-words"
                    >
                      {m.reply_to && (
                        <button
                          type="button"
                          onClick={() => jumpTo(m.reply_to!.id)}
                          className="mb-1.5 block w-full rounded-lg border-l-2 bg-background/40 px-2 py-1 text-left"
                          style={{
                            borderColor: m.reply_to.author_id
                              ? speakerColor(m.reply_to.author_id)
                              : "var(--border)",
                          }}
                        >
                          <span
                            className="block text-[10px] font-semibold"
                            style={{
                              color: m.reply_to.author_id
                                ? speakerColor(m.reply_to.author_id)
                                : undefined,
                            }}
                          >
                            {m.reply_to.author_name ?? "Unknown"}
                          </span>
                          <span className="line-clamp-2 block text-[11px] text-muted-foreground">
                            {m.reply_to.deleted ? "Message deleted" : m.reply_to.body}
                          </span>
                        </button>
                      )}
                      {m.body}
                    </ChatBubbleMessage>

                    <div
                      className={`mt-1 flex items-center gap-2 ${
                        m.mine ? "justify-end" : "justify-start"
                      }`}
                    >
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
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
                      >
                        <Reply className="h-3 w-3" /> Reply
                      </button>
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
                </ChatBubble>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {warning && (
          <p className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-foreground">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>{warning}</span>
          </p>
        )}
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-border/60 bg-surface/50 p-2">
            <div
              className="w-0.5 shrink-0 self-stretch rounded-full"
              style={{ background: speakerColor(replyTo.author_id) }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-semibold"
                style={{ color: speakerColor(replyTo.author_id) }}
              >
                Replying to {replyTo.author_name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{replyTo.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) sendM.mutate();
          }}
        >
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
            onKeyDown={(e) => {
              // Escape drops the quote rather than the draft, matching every
              // chat client the reader already uses.
              if (e.key === "Escape" && replyTo) {
                e.preventDefault();
                setReplyTo(null);
              }
            }}
            placeholder={replyTo ? "Write a reply…" : "Write a message…"}
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

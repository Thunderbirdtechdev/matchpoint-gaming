import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, LifeBuoy, Paperclip, ArrowLeft, Gavel, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRoles } from "@/hooks/use-roles";
import {
  getDisputeDetail,
  recommendDisputeResolution,
  approveDisputeResolution,
  rejectDisputeRecommendation,
} from "@/lib/matches.functions";
import { getTicket, replyToTicket, updateTicket } from "@/lib/support.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { RequireCapability } from "@/components/dashboard/RequireCapability";
import { ChatModerationQueue } from "@/components/chat/ChatModerationQueue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Status } from "@/components/ui/status";
import { IconTile } from "@/components/ui/icon-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/moderator")({
  head: () => ({ meta: [{ title: "Moderator | MatchPoint" }] }),
  component: ModeratorPage,
});

const DISPUTE_VARIANT: Record<string, "warning" | "info" | "success" | "default"> = {
  open: "warning",
  awaiting_approval: "info",
  resolved: "success",
};

function ModeratorPage() {
  const [tab, setTab] = useState<"disputes" | "tickets" | "chat">("disputes");
  const [openDispute, setOpenDispute] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);

  const { canAny } = useRoles();
  const isStaff = canAny(["moderation.disputes.review", "moderation.tickets"]);

  const { data: disputes } = useQuery({
    queryKey: ["all-disputes"],
    enabled: isStaff,
    queryFn: async () =>
      (await supabase.from("disputes").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  const { data: tickets } = useQuery({
    queryKey: ["all-tickets"],
    enabled: isStaff,
    queryFn: async () =>
      (await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }))
        .data ?? [],
  });

  if (openDispute) {
    return <DisputeReview disputeId={openDispute} onBack={() => setOpenDispute(null)} />;
  }
  if (openTicket) {
    return <StaffTicketThread ticketId={openTicket} onBack={() => setOpenTicket(null)} />;
  }

  const openDisputes = (disputes ?? []).filter((d) => d.status !== "resolved").length;
  const openTickets = (tickets ?? []).filter((t) => t.status === "open").length;

  return (
    <RequireCapability
      anyOf={["moderation.disputes.review", "moderation.tickets"]}
      title="Moderator queue"
      subtitle="Review disputes and answer support tickets."
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as "disputes" | "tickets" | "chat")}>
        <TabsList className="h-auto bg-surface/50 p-1">
          <TabsTrigger value="disputes" className="gap-2 px-4 py-2 text-xs font-bold uppercase">
            <ShieldAlert className="h-3.5 w-3.5" />
            Disputes <span className="text-muted-foreground">({openDisputes})</span>
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-2 px-4 py-2 text-xs font-bold uppercase">
            <LifeBuoy className="h-3.5 w-3.5" />
            Tickets <span className="text-muted-foreground">({openTickets})</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-2 px-4 py-2 text-xs font-bold uppercase">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "chat" ? (
        <ChatModerationQueue />
      ) : tab === "disputes" ? (
        <div className="mt-6 grid gap-3">
          {disputes?.length ? (
            disputes.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setOpenDispute(d.id)}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-gradient-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">{d.reason}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {new Date(d.created_at).toLocaleString()}
                    {d.recommended_winner_id && " · winner recommended"}
                  </div>
                </div>
                <Status variant={DISPUTE_VARIANT[d.status] ?? "default"}>
                  {d.status.replace(/_/g, " ")}
                </Status>
              </button>
            ))
          ) : (
            <Empty icon={<ShieldAlert className="h-5 w-5" />} text="No disputes to review." />
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {tickets?.length ? (
            tickets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenTicket(t.id)}
                className="flex items-start justify-between gap-4 rounded-xl border border-border/60 bg-gradient-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{t.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t.category} · {t.priority} · {new Date(t.updated_at).toLocaleString()}
                  </div>
                </div>
                <Status
                  variant={
                    t.status === "open" ? "info" : t.status === "pending" ? "warning" : "success"
                  }
                >
                  {t.status}
                </Status>
              </button>
            ))
          ) : (
            <Empty icon={<LifeBuoy className="h-5 w-5" />} text="No tickets in the queue." />
          )}
        </div>
      )}
    </RequireCapability>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 bg-surface/20 px-6 py-16 text-center">
      <IconTile size="lg">{icon}</IconTile>
      <p className="mt-4 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

/**
 * Dispute review. A moderator recommends a winner; a *different* admin approves,
 * and only that approval releases escrow. The server enforces both halves — the
 * UI just makes the split legible.
 */
function DisputeReview({ disputeId, onBack }: { disputeId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const fetchDetail = useServerFn(getDisputeDetail);
  const recommendFn = useServerFn(recommendDisputeResolution);
  const approveFn = useServerFn(approveDisputeResolution);
  const rejectFn = useServerFn(rejectDisputeRecommendation);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dispute-detail", disputeId],
    queryFn: async () => await fetchDetail({ data: { dispute_id: disputeId } }),
  });

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["dispute-detail", disputeId] });
      qc.invalidateQueries({ queryKey: ["all-disputes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Dispute review">
        <Skeleton className="h-72 w-full rounded-2xl" />
      </DashboardShell>
    );
  }

  const d = data!.dispute;
  const players = data!.players;
  const settled = d.status === "resolved";
  const awaiting = d.status === "awaiting_approval";

  const nameOf = (id: string | null) => {
    const p = players.find((x) => x.id === id);
    return p?.display_name || p?.username || (id ? `${id.slice(0, 8)}…` : "-");
  };

  return (
    <DashboardShell title="Dispute review" subtitle={d.reason}>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to queue
      </Button>

      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Status variant={DISPUTE_VARIANT[d.status] ?? "default"}>
            {d.status.replace(/_/g, " ")}
          </Status>
          <span className="text-xs text-muted-foreground">
            Opened {new Date(d.created_at).toLocaleString()}
          </span>
        </div>

        {/* Who is involved */}
        <div className="grid gap-3 sm:grid-cols-2">
          {players.map((p) => (
            <div key={p.id} className="rounded-xl border border-border/60 bg-gradient-card p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Player
              </div>
              <div className="mt-1 font-medium">{p.display_name || p.username}</div>
              {d.recommended_winner_id === p.id && (
                <Status variant="info" className="mt-2">
                  Recommended winner
                </Status>
              )}
            </div>
          ))}
        </div>

        {/* Evidence — the reason match_evidence exists */}
        <div className="rounded-2xl border border-border/60 bg-gradient-card p-5">
          <h3 className="text-sm font-semibold">Evidence</h3>
          {data!.evidence.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Neither player attached anything to this match.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {data!.evidence.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 p-3"
                >
                  <IconTile size="sm">
                    <Paperclip className="h-4 w-4" />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium capitalize">{e.kind}</div>
                    <div className="text-[11px] text-muted-foreground">
                      from {nameOf(e.user_id)} · {new Date(e.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-primary-glow hover:underline"
                    >
                      View
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Decision */}
        {!settled && (
          <div className="space-y-4 rounded-2xl border border-border/60 bg-gradient-card p-5">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary-glow" />
              <h3 className="text-sm font-semibold">Decision</h3>
            </div>

            {!awaiting ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Record who you believe won. This moves no money, an admin confirms it separately,
                  and only that step releases escrow.
                </p>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did the evidence show?"
                />
                <div className="flex flex-wrap gap-3">
                  {players.map((p) => (
                    <Button
                      key={p.id}
                      disabled={busy}
                      onClick={() =>
                        run("Recommendation recorded, awaiting admin approval.", () =>
                          recommendFn({
                            data: {
                              dispute_id: disputeId,
                              recommended_winner_id: p.id,
                              review_note: note || undefined,
                            },
                          }),
                        )
                      }
                      variant="outline"
                    >
                      {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      {p.display_name || p.username} won
                    </Button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-400">
                  A moderator recommended <strong>{nameOf(d.recommended_winner_id)}</strong>.
                  {d.review_note && <div className="mt-1 opacity-80">“{d.review_note}”</div>}
                </div>

                {data!.isAdmin ? (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        run("Approved, escrow released to the winner.", () =>
                          approveFn({ data: { dispute_id: disputeId } }),
                        )
                      }
                      className="bg-gradient-brand text-primary-foreground"
                    >
                      {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Approve and pay out
                    </Button>
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        run("Sent back for another look.", () =>
                          rejectFn({ data: { dispute_id: disputeId } }),
                        )
                      }
                    >
                      Send back
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Waiting on an admin to confirm. Releasing escrow needs admin rights, and it
                    cannot be the same person who reviewed it.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {settled && (
          <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm text-green-400">
            Resolved, {d.resolution}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function StaffTicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const fetchTicket = useServerFn(getTicket);
  const replyFn = useServerFn(replyToTicket);
  const updateFn = useServerFn(updateTicket);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => await fetchTicket({ data: { ticket_id: ticketId } }),
  });

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["all-tickets"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <DashboardShell title="Ticket">
        <Skeleton className="h-72 w-full rounded-2xl" />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Ticket" subtitle={data!.ticket.subject}>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Back to queue
      </Button>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Status variant={data!.ticket.status === "resolved" ? "success" : "info"}>
            {data!.ticket.status}
          </Status>
          <span className="text-xs text-muted-foreground">
            {data!.ticket.category} · {data!.ticket.priority}
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run("Assigned to you.", () =>
                  updateFn({ data: { ticket_id: ticketId, assign_to_me: true } }),
                )
              }
            >
              Assign to me
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run("Marked resolved.", () =>
                  updateFn({ data: { ticket_id: ticketId, status: "resolved" } }),
                )
              }
            >
              Resolve
            </Button>
          </div>
        </div>

        <ul className="space-y-3">
          {data!.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-2xl border p-4 ${
                m.is_staff ? "border-primary/30 bg-primary/5" : "border-border/60 bg-gradient-card"
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {m.is_staff ? "Support" : "Player"} · {new Date(m.created_at).toLocaleString()}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
              {m.attachment_url && (
                <a
                  href={m.attachment_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-glow hover:underline"
                >
                  <Paperclip className="h-3 w-3" />
                  View attachment
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-gradient-card p-4">
          <Textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Reply to the player…"
          />
          <Button
            disabled={busy || !body.trim()}
            onClick={() =>
              run("Reply sent.", async () => {
                await replyFn({ data: { ticket_id: ticketId, body: body.trim() } });
                setBody("");
              })
            }
            className="bg-gradient-brand text-primary-foreground"
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Send reply
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}

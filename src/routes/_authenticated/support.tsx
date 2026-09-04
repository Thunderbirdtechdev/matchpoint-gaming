import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LifeBuoy, Paperclip, Send, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { createTicket, replyToTicket, getTicket } from "@/lib/support.functions";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Status } from "@/components/ui/status";
import { IconTile } from "@/components/ui/icon-tile";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [{ title: "Support | MatchPoint" }] }),
  component: SupportPage,
});

const CATEGORIES = [
  { id: "payout", label: "Payout problem" },
  { id: "deposit", label: "Deposit problem" },
  { id: "match", label: "Match or result" },
  { id: "account", label: "My account" },
  { id: "bug", label: "Something is broken" },
  { id: "other", label: "Something else" },
] as const;

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "default"> = {
  open: "info",
  pending: "warning",
  resolved: "success",
  closed: "default",
};

/** Upload to the private support bucket. Returns the storage path, not a URL. */
async function uploadAttachment(userId: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("That file is over 10MB.");
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("support-attachments")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("support_tickets")
          .select("*")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false })
      ).data ?? [],
  });

  if (openId) {
    return <TicketThread ticketId={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <DashboardShell title="Support" subtitle="Tell us what went wrong and we'll take a look.">
      <div className="mb-6 flex justify-end">
        <Button
          onClick={() => setComposing((v) => !v)}
          className="bg-gradient-brand text-primary-foreground"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {composing ? "Cancel" : "New ticket"}
        </Button>
      </div>

      {composing && (
        <NewTicketForm
          userId={user!.id}
          onDone={(id) => {
            setComposing(false);
            qc.invalidateQueries({ queryKey: ["my-tickets", user?.id] });
            setOpenId(id);
          }}
        />
      )}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !tickets?.length ? (
        <div className="mt-6 grid place-items-center rounded-2xl border border-dashed border-border/60 bg-surface/20 px-6 py-16 text-center">
          <IconTile size="lg">
            <LifeBuoy className="h-5 w-5" />
          </IconTile>
          <p className="mt-4 text-sm text-muted-foreground">
            No tickets yet. Open one and a human will reply.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-border/60 bg-gradient-card p-4 text-left transition-colors hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.subject}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category} ·{" "}
                    {new Date(t.updated_at).toLocaleString()}
                  </div>
                </div>
                <Status variant={STATUS_VARIANT[t.status] ?? "default"}>{t.status}</Status>
              </button>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}

function NewTicketForm({ userId, onDone }: { userId: string; onDone: (id: string) => void }) {
  const createFn = useServerFn(createTicket);
  const [category, setCategory] = useState<string>("other");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (subject.trim().length < 4) return toast.error("Give it a short subject.");
    if (body.trim().length < 10) return toast.error("Tell us a bit more so we can help.");

    setBusy(true);
    try {
      let attachment_path: string | undefined;
      if (file) attachment_path = await uploadAttachment(userId, file);

      const res = await createFn({
        data: {
          category: category as (typeof CATEGORIES)[number]["id"],
          subject: subject.trim(),
          body: body.trim(),
          attachment_path,
        },
      });
      toast.success("Ticket opened, we'll reply here.");
      onDone(res.ticket_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the ticket");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/60 bg-gradient-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>What is it about?</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Cash out hasn't arrived"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">What happened?</Label>
        <Textarea
          id="body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Include dates, amounts and match links if you have them."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy}
          onClick={submit}
          className="bg-gradient-brand text-primary-foreground"
        >
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Open ticket
        </Button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          {file ? file.name : "Attach a screenshot"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
    </div>
  );
}

function TicketThread({ ticketId, onBack }: { ticketId: string; onBack: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchTicket = useServerFn(getTicket);
  const replyFn = useServerFn(replyToTicket);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => await fetchTicket({ data: { ticket_id: ticketId } }),
  });

  async function send() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      let attachment_path: string | undefined;
      if (file && user) attachment_path = await uploadAttachment(user.id, file);
      await replyFn({ data: { ticket_id: ticketId, body: body.trim(), attachment_path } });
      setBody("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      qc.invalidateQueries({ queryKey: ["my-tickets", user?.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardShell title="Support" subtitle={data?.ticket?.subject ?? "Loading…"}>
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        All tickets
      </Button>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Status variant={STATUS_VARIANT[data!.ticket.status] ?? "default"}>
              {data!.ticket.status}
            </Status>
            <span className="text-xs text-muted-foreground">
              Opened {new Date(data!.ticket.created_at).toLocaleString()}
            </span>
          </div>

          <ul className="space-y-3">
            {data!.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-2xl border p-4 ${
                  m.is_staff
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/60 bg-gradient-card"
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {m.is_staff ? "MatchPoint Support" : "You"} ·{" "}
                  {new Date(m.created_at).toLocaleString()}
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

          {data!.ticket.status !== "closed" && (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-gradient-card p-4">
              <Textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Add a reply…"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy || !body.trim()}
                  onClick={send}
                  className="bg-gradient-brand text-primary-foreground"
                >
                  {busy ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-4 w-4" />
                  )}
                  Send
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Paperclip className="h-3.5 w-3.5" />
                  {file ? file.name : "Attach"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}

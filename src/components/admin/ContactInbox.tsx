/**
 * Enquiries from the contact form.
 *
 * The email notification is a nudge, not the record. Someone has to be able to
 * come back a week later and find the tournament organiser who wrote in, which
 * an inbox nobody owns cannot do.
 *
 * Partnership enquiries are visually separated from the rest because they are a
 * different kind of thing: a support question is a task, a white-label enquiry
 * is a lead, and burying the second in a list of the first is how it gets
 * answered four days late.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake, Mail, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { listContactMessages, updateContactMessage } from "@/lib/contact.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/status";

type Row = {
  id: string;
  topic: string;
  name: string;
  email: string;
  organisation: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
};

export function ContactInbox() {
  const qc = useQueryClient();
  const listFn = useServerFn(listContactMessages);
  const updateFn = useServerFn(updateContactMessage);

  const q = useQuery({
    queryKey: ["contact-messages"],
    queryFn: () => listFn({ data: {} }) as Promise<Row[]>,
  });

  const mark = useMutation({
    mutationFn: async (v: { id: string; status: "read" | "closed" }) => updateFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) {
    return (
      <div className="mt-6 space-y-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  const rows = (q.data ?? []).filter((r) => r.status !== "closed");
  const leads = rows.filter((r) => r.topic === "partnership");
  const rest = rows.filter((r) => r.topic !== "partnership");

  if (!rows.length) {
    return (
      <p className="mt-6 rounded-xl border border-border/60 bg-gradient-card p-6 text-center text-sm text-muted-foreground">
        No open enquiries.
      </p>
    );
  }

  const Card = ({ r }: { r: Row }) => (
    <li className="rounded-xl border border-border/60 bg-gradient-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{r.name}</span>
        <a
          href={`mailto:${r.email}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          {r.email}
        </a>
        {r.organisation && (
          <>
            <span>·</span>
            <span>{r.organisation}</span>
          </>
        )}
        <span>·</span>
        <span>{new Date(r.created_at).toLocaleString()}</span>
        {r.status === "new" && <Status variant="info">New</Status>}
      </div>

      <p className="mt-2 text-sm font-medium">{r.subject}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {r.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${r.email}?subject=Re: ${encodeURIComponent(r.subject)}`}>
            <Mail className="mr-1.5 h-3.5 w-3.5" /> Reply
          </a>
        </Button>
        {r.status === "new" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={mark.isPending}
            onClick={() => mark.mutate({ id: r.id, status: "read" })}
          >
            Mark read
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={mark.isPending}
          onClick={() => mark.mutate({ id: r.id, status: "closed" })}
        >
          {mark.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-3.5 w-3.5" />
          )}
          Close
        </Button>
      </div>
    </li>
  );

  return (
    <div className="mt-6 space-y-8">
      {leads.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Handshake className="h-4 w-4 text-primary" /> Tournament &amp; white-label enquiries
            <span className="text-muted-foreground">({leads.length})</span>
          </h3>
          <ul className="mt-3 space-y-3">
            {leads.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Mail className="h-4 w-4" /> Everything else
            <span className="text-muted-foreground">({rest.length})</span>
          </h3>
          <ul className="mt-3 space-y-3">
            {rest.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Module 10 — tournament lifecycle mail.
 *
 * `canceled` is the one that has to be right. A cancelled tournament refunds
 * every entrant's stake, and a player who paid to enter something that then
 * vanished will assume the worst unless the email says, in the first sentence,
 * that their money is back. So the refund figure is the headline there, not a
 * detail line.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Amount, Detail, DetailCard, EmailShell, Row, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

export type TournamentStatus = "joined" | "placed" | "eliminated" | "canceled";

interface Props {
  status?: TournamentStatus;
  tournamentName?: string;
  game?: string;
  entryFormatted?: string;
  /** Prize for a placed player, or the refund for a cancelled tournament. */
  amountFormatted?: string;
  place?: number;
  startsAt?: string;
  tournamentId?: string;
  note?: string | null;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const COPY: Record<
  TournamentStatus,
  { title: (p: Props) => string; preview: string; intro: string; tone: string; cta: string }
> = {
  joined: {
    title: () => "You're in",
    preview: "Your tournament entry is confirmed.",
    intro:
      "Your entry is confirmed and your stake is held in escrow. We'll email you when the bracket goes live.",
    tone: "#2563EB",
    cta: "View the tournament",
  },
  placed: {
    title: (p) => (p.place ? `You finished ${ordinal(p.place)}` : "You placed"),
    preview: "You finished in the money.",
    intro:
      "The tournament is over and you finished in a paying position. Your prize is in your wallet.",
    tone: "#16a34a",
    cta: "View your wallet",
  },
  eliminated: {
    title: () => "Tournament over",
    preview: "Your tournament run has ended.",
    intro:
      "Your run in this tournament has ended. Thanks for playing. There's always the next one.",
    tone: brand.text,
    cta: "Find another tournament",
  },
  canceled: {
    title: () => "Tournament canceled and refunded",
    preview: "The tournament was canceled and your entry fee is back in your wallet.",
    // Refund first. The question this email has to answer before any other is
    // "where is my money", and burying that under an apology invites a support
    // ticket for something that has already been handled.
    intro:
      "This tournament was canceled. Your entry fee has been returned to your wallet in full. You don't need to do anything.",
    tone: "#f59e0b",
    cta: "View your wallet",
  },
};

const Email = (props: Props) => {
  const {
    status = "joined",
    tournamentName,
    game,
    entryFormatted,
    amountFormatted,
    startsAt,
    tournamentId,
    note,
  } = props;
  const copy = COPY[status] ?? COPY.joined;
  const href =
    status === "placed" || status === "canceled"
      ? `${SITE}/wallet`
      : tournamentId
        ? `${SITE}/tournament/${tournamentId}`
        : `${SITE}/marketplace`;

  const amountLabel = status === "canceled" ? "Refunded" : status === "placed" ? "Prize" : "Entry";

  return (
    <EmailShell
      preview={copy.preview}
      title={copy.title(props)}
      tone={copy.tone}
      intro={copy.intro}
      cta={{ label: copy.cta, href }}
    >
      <DetailCard>
        {entryFormatted || amountFormatted ? (
          <Row>
            {entryFormatted && status !== "canceled" ? (
              <Amount label="Entry" value={entryFormatted} />
            ) : null}
            {amountFormatted ? (
              <Amount label={amountLabel} value={amountFormatted} tone={copy.tone} />
            ) : null}
          </Row>
        ) : null}
        <Detail label="Tournament" value={tournamentName} />
        <Detail label="Game" value={game} />
        <Detail label="Starts" value={startsAt} />
        {note ? <Detail label="Note" value={note} /> : null}
        {tournamentId ? (
          <Text style={{ ...text, margin: "4px 0", fontSize: 12, color: brand.textLight }}>
            Ref: {tournamentId}
          </Text>
        ) : null}
      </DetailCard>
    </EmailShell>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const status = (d?.status as TournamentStatus) ?? "joined";
    const copy = COPY[status] ?? COPY.joined;
    const title = copy.title(d as Props);
    return d?.tournamentName ? `${title} · ${d.tournamentName}` : title;
  },
  displayName: "Tournament update",
  previewData: {
    status: "joined",
    tournamentName: "Friday Night 2K Showdown",
    game: "NBA 2K27",
    entryFormatted: "$10.00",
    tournamentId: "00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;

export default Email;

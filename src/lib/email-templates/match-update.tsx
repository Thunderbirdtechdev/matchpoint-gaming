/**
 * Module 10 — everything that happens to a 1v1 match.
 *
 * One template with a status map rather than five files, following the pattern
 * `user-payout-update` already set. These five states share a layout, a detail
 * card and a link; what differs is a headline, a colour and a sentence.
 *
 * The states are written from the RECIPIENT's point of view, which is why
 * `settled_won` and `settled_lost` are separate: the same event produces two
 * genuinely different emails, and sending the loser a cheerful "match settled!"
 * is the kind of detail that makes a product feel like it is not paying
 * attention.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Amount, Detail, DetailCard, EmailShell, Row, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

export type MatchStatus =
  | "accepted"
  | "settled_won"
  | "settled_lost"
  | "disputed"
  | "dispute_resolved";

interface Props {
  status?: MatchStatus;
  /** The other player's display name. */
  opponent?: string;
  game?: string;
  platform?: string;
  stakeFormatted?: string;
  /** What the recipient actually receives, after the platform fee. */
  payoutFormatted?: string;
  challengeId?: string;
  /** Free text: dispute reason, or the reviewer's resolution note. */
  note?: string | null;
}

const COPY: Record<
  MatchStatus,
  { title: string; preview: string; intro: string; tone: string; cta: string }
> = {
  accepted: {
    title: "Your challenge was accepted",
    preview: "Someone accepted your challenge — time to play.",
    intro:
      "Your challenge has been accepted and the stake is now held in escrow for both players. Arrange the match and report the result when you're done.",
    tone: brand.primary,
    cta: "View the match",
  },
  settled_won: {
    title: "You won",
    preview: "You won your match — your winnings are in your wallet.",
    intro: "Nice one. The match is settled and your winnings have landed in your wallet.",
    tone: "#16a34a",
    cta: "View your wallet",
  },
  settled_lost: {
    title: "Match settled",
    preview: "Your match has been settled.",
    // No commiseration and no false cheer. It states the outcome and what it
    // cost, which is the only thing the loser of a money match wants from an
    // email about it.
    intro: "This match has been settled and the stake has been released to the winner.",
    tone: brand.text,
    cta: "View the match",
  },
  disputed: {
    title: "A dispute was opened on your match",
    preview: "Your match is under review.",
    intro:
      "The two reported results didn't match, so this one has gone to our review team. The stake stays in escrow until it's resolved — nobody has been paid.",
    tone: "#f59e0b",
    cta: "View the dispute",
  },
  dispute_resolved: {
    title: "Your dispute has been resolved",
    preview: "A decision has been made on your disputed match.",
    intro: "Our team has reviewed the evidence and settled this match.",
    tone: brand.primary,
    cta: "View the match",
  },
};

const Email = ({
  status = "accepted",
  opponent,
  game,
  platform,
  stakeFormatted,
  payoutFormatted,
  challengeId,
  note,
}: Props) => {
  const copy = COPY[status] ?? COPY.accepted;
  const href = challengeId ? `${SITE}/match/${challengeId}` : `${SITE}/dashboard`;

  return (
    <EmailShell
      preview={copy.preview}
      title={copy.title}
      tone={copy.tone}
      intro={copy.intro}
      cta={{ label: copy.cta, href }}
    >
      <DetailCard>
        {stakeFormatted || payoutFormatted ? (
          <Row>
            {stakeFormatted ? <Amount label="Stake" value={stakeFormatted} /> : null}
            {payoutFormatted ? (
              <Amount label="You receive" value={payoutFormatted} tone={copy.tone} />
            ) : null}
          </Row>
        ) : null}
        <Detail label="Opponent" value={opponent} />
        <Detail label="Game" value={game} />
        <Detail label="Platform" value={platform} />
        {note ? <Detail label="Note" value={note} /> : null}
        {challengeId ? (
          <Text style={{ ...text, margin: "4px 0", fontSize: 12, color: brand.textLight }}>
            Match ref: {challengeId}
          </Text>
        ) : null}
      </DetailCard>
    </EmailShell>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const copy = COPY[(d?.status as MatchStatus) ?? "accepted"] ?? COPY.accepted;
    return d?.opponent ? `${copy.title} · vs ${d.opponent}` : copy.title;
  },
  displayName: "Match update",
  previewData: {
    status: "settled_won",
    opponent: "ShadowStrike",
    game: "NBA 2K27",
    platform: "PlayStation 5",
    stakeFormatted: "$25.00",
    payoutFormatted: "$47.50",
    challengeId: "00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;

export default Email;

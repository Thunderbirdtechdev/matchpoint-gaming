/**
 * Module 10 — staff replied to a support ticket.
 *
 * Module 6 shipped the ticket portal and left this note: "No email notification
 * when staff reply — pairs with Kevin's Resend request (12.7)." Without it, a
 * reply only exists if the player happens to come back and look, which for a
 * support system is close to not having replied at all.
 *
 * ⚠️ The reply body is quoted but NOT the whole thread, and the email does not
 * accept replies by mail. Ticket threads can contain evidence and payment
 * details; mirroring the full history into an inbox widens where that lives for
 * no benefit the "View the ticket" link doesn't already give.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Detail, DetailCard, EmailShell, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

interface Props {
  ticketSubject?: string;
  staffName?: string;
  /** The latest reply only. Truncated by the caller. */
  replyPreview?: string;
  ticketId?: string;
  status?: string;
}

const Email = ({ ticketSubject, staffName, replyPreview, ticketId, status }: Props) => (
  <EmailShell
    preview={`${staffName || "Support"} replied to your ticket.`}
    title="Support replied"
    tone={brand.primary}
    intro={`${staffName || "Our support team"} has replied to your ticket.`}
    cta={{ label: "View the ticket", href: `${SITE}/support` }}
  >
    <DetailCard>
      <Detail label="Ticket" value={ticketSubject} />
      <Detail label="Status" value={status} />
      {replyPreview ? (
        <>
          <Text style={{ ...text, margin: "12px 0 4px", fontSize: 12, color: brand.textLight }}>
            Their reply
          </Text>
          <Text
            style={{
              ...text,
              margin: 0,
              fontSize: 14,
              color: brand.dark,
              borderLeft: `3px solid ${brand.border}`,
              paddingLeft: 12,
            }}
          >
            {replyPreview}
          </Text>
        </>
      ) : null}
      {ticketId ? (
        <Text style={{ ...text, margin: "12px 0 0", fontSize: 12, color: brand.textLight }}>
          Ref: {ticketId}
        </Text>
      ) : null}
    </DetailCard>
    <Text style={{ ...text, fontSize: 12, color: brand.textLight }}>
      Replying to this email won't reach us — use the link above so your message stays on the
      ticket.
    </Text>
  </EmailShell>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.ticketSubject ? `Re: ${d.ticketSubject}` : "Support replied to your ticket",
  displayName: "Support reply",
  previewData: {
    ticketSubject: "Deposit didn't show up",
    staffName: "Jordan",
    replyPreview:
      "Thanks for flagging this — I can see the payment landed and I've credited your wallet manually.",
    status: "pending",
    ticketId: "00000000-0000-0000-0000-000000000000",
  },
} satisfies TemplateEntry;

export default Email;

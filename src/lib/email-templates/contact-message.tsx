/**
 * Somebody used the contact form.
 *
 * Goes to staff, not to the sender, and the subject leads with the topic
 * because these arrive in a mixed inbox where the ones that matter are not the
 * common ones. A white-label enquiry from a tournament organiser is a sales
 * lead; "how do I reset my password" is not, and they should be
 * distinguishable at a glance in a notification list.
 *
 * The whole message body is included rather than a preview. This is the one
 * notification where the recipient's next action depends on the content — you
 * cannot decide whether to drop everything for a partnership enquiry from a
 * truncated first line.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Detail, DetailCard, EmailShell, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

interface Props {
  topic?: string;
  name?: string;
  email?: string;
  organisation?: string | null;
  subject?: string;
  message?: string;
}

const Email = ({ topic, name, email, organisation, subject, message }: Props) => (
  <EmailShell
    preview={`${topic || "Enquiry"} from ${name || "someone"}`}
    title="New enquiry"
    tone={brand.primary}
    intro={`${name || "Someone"} used the contact form on the site.`}
    cta={{ label: "Open the admin queue", href: `${SITE}/moderator` }}
  >
    <DetailCard>
      <Detail label="About" value={topic} />
      <Detail label="From" value={name} />
      <Detail label="Email" value={email} />
      {organisation ? <Detail label="Organisation" value={organisation} /> : null}
      <Detail label="Subject" value={subject} />
    </DetailCard>

    <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{message}</Text>

    <Text style={{ ...text, fontSize: 12, color: brand.textLight }}>
      Reply to {email} directly. This address is not monitored.
    </Text>
  </EmailShell>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `${d?.topic || "Enquiry"}: ${d?.subject || "New message"}`,
  displayName: "Contact form message",
  previewData: {
    topic: "Run tournaments with MatchPoint",
    name: "Jordan Ellis",
    email: "jordan@exampleesports.com",
    organisation: "Example Esports",
    subject: "White-label bracket software",
    message:
      "We run weekly 128-player tournaments and are looking for something to handle brackets and payouts. Can we talk about running them on MatchPoint under our own branding?",
  },
} satisfies TemplateEntry;

export default Email;

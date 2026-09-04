/**
 * Module 10 — a high-severity security flag was raised.
 *
 * Module 9's queue only exists when someone opens `/security`, and the scan
 * only runs when someone asks it to. That is honest but it is not a control: a
 * staff account crediting its own wallet would sit unread until the next time
 * somebody happened to look.
 *
 * ⚠️ Goes to STAFF, not to the player. And deliberately thin on detail — it
 * names the finding and links to the queue, and does not restate the evidence.
 * Alert mail lands in inboxes, gets forwarded, and sits in phone notifications;
 * the details of a suspected fraud belong behind the capability check that
 * guards `/security`, not in an email thread.
 *
 * Only `high` severity mails. Medium and low would train people to ignore it,
 * and an alert people ignore is worse than no alert at all — it creates the
 * belief that someone is watching.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Detail, DetailCard, EmailShell, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

interface Props {
  findingTitle?: string;
  kind?: string;
  /** How many high-severity findings this scan raised in total. */
  totalHigh?: number;
  scannedAt?: string;
}

const Email = ({ findingTitle, kind, totalHigh, scannedAt }: Props) => (
  <EmailShell
    preview="A high-severity security flag needs review."
    title="Security flag raised"
    tone="#dc2626"
    intro={
      totalHigh && totalHigh > 1
        ? `A security scan raised ${totalHigh} high-severity findings. Review them in the security queue.`
        : "A security scan raised a high-severity finding. Review it in the security queue."
    }
    cta={{ label: "Open the security queue", href: `${SITE}/security` }}
  >
    <DetailCard>
      <Detail label="Finding" value={findingTitle} />
      <Detail label="Type" value={kind?.replace(/_/g, " ")} />
      <Detail label="Detected" value={scannedAt} />
    </DetailCard>
    <Text style={{ ...text, fontSize: 12, color: brand.textLight }}>
      Details are kept in the app rather than in this email. You're receiving this because your
      account can review security flags.
    </Text>
  </EmailShell>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.totalHigh && d.totalHigh > 1
      ? `${d.totalHigh} security flags need review`
      : "A security flag needs review",
  displayName: "Security alert (staff)",
  previewData: {
    findingTitle: "Staff account acted on its own account 2×",
    kind: "self_dealing",
    totalHigh: 1,
    scannedAt: "4 Sep 2026, 14:20",
  },
} satisfies TemplateEntry;

export default Email;

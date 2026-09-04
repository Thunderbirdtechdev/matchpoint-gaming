/**
 * Module 10 — someone was given a staff role.
 *
 * Module 7 left this as "No email when someone is granted a staff role — pairs
 * with Resend (12.7)."
 *
 * This is a security notification as much as a welcome. If an account is
 * granted admin and its owner did not expect it, that is something they need to
 * find out about immediately and from a channel the attacker does not control —
 * which is the argument for mailing it rather than only showing a badge in the
 * app. Hence the closing line: it tells the recipient what to do if this is a
 * surprise, and it is not optional politeness.
 */

import React from "react";
import type { TemplateEntry } from "./registry";
import { Detail, DetailCard, EmailShell, SITE, brand, text } from "./_shell";
import { Text } from "@react-email/components";

interface Props {
  roleLabel?: string;
  roleDescription?: string;
  grantedBy?: string;
  requiresMfa?: boolean;
}

const Email = ({ roleLabel, roleDescription, grantedBy, requiresMfa }: Props) => (
  <EmailShell
    preview={`You've been given ${roleLabel || "staff"} access on MatchPoint.`}
    title={`You're now ${roleLabel ? `a ${roleLabel}` : "staff"}`}
    tone={brand.violet}
    intro={`${grantedBy || "A super admin"} has given your account ${roleLabel || "staff"} access on MatchPoint.`}
    cta={{ label: "Open the dashboard", href: `${SITE}/dashboard` }}
  >
    <DetailCard>
      <Detail label="Role" value={roleLabel} />
      <Detail label="What it allows" value={roleDescription} />
      <Detail label="Granted by" value={grantedBy} />
    </DetailCard>

    {requiresMfa ? (
      <Text style={{ ...text, fontSize: 13 }}>
        <strong>Set up two-factor authentication before you start.</strong> This role can move
        money, and those actions require a second factor. Go to Profile → Security.
      </Text>
    ) : null}

    <Text style={{ ...text, fontSize: 12, color: brand.textLight }}>
      If you weren't expecting this, your account may be compromised — change your password and
      contact a super admin straight away.
    </Text>
  </EmailShell>
);

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.roleLabel ? `You're now a ${d.roleLabel} on MatchPoint` : "You've been given staff access",
  displayName: "Staff role granted",
  previewData: {
    roleLabel: "Moderator",
    roleDescription: "Front-line review of disputes and support tickets.",
    grantedBy: "Kevin",
    requiresMfa: false,
  },
} satisfies TemplateEntry;

export default Email;

import type { ComponentType } from "react";
import { template as payoutStatusTemplate } from "./payout-status";
import { template as waitlistWelcomeTemplate } from "./waitlist-welcome";
import { template as depositConfirmationTemplate } from "./deposit-confirmation";
import { template as userPayoutUpdateTemplate } from "./user-payout-update";
// Module 10
import { template as matchUpdateTemplate } from "./match-update";
import { template as tournamentUpdateTemplate } from "./tournament-update";
import { template as supportReplyTemplate } from "./support-reply";
import { template as roleGrantedTemplate } from "./role-granted";
import { template as securityAlertTemplate } from "./security-alert";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "payout-status": payoutStatusTemplate,
  "waitlist-welcome": waitlistWelcomeTemplate,
  "deposit-confirmation": depositConfirmationTemplate,
  "user-payout-update": userPayoutUpdateTemplate,

  // Module 10. `match-update` and `tournament-update` each carry several
  // states behind a `status` field rather than being split into one template
  // per event — see the note at the top of match-update.tsx.
  "match-update": matchUpdateTemplate,
  "tournament-update": tournamentUpdateTemplate,
  "support-reply": supportReplyTemplate,
  "role-granted": roleGrantedTemplate,
  "security-alert": securityAlertTemplate,
};

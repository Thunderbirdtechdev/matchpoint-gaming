/**
 * Module 9 — Security, audit and compliance.
 *
 * Its own route for the same reason Module 8 gave Finance one: /admin is
 * already 1400 lines serving two different jobs, and this page is read by a
 * third — whoever is answering "who did that, and when". Gated on
 * `security.audit.view`, which admin, financial_admin and super_admin hold.
 *
 * The enforcement switches are visible to all three but editable only with
 * `security.settings` (super_admin), so the people whose actions the controls
 * restrain can see the rules without being able to change them.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { RequireCapability } from "@/components/dashboard/RequireCapability";
import { AuditTable } from "@/components/security/AuditTable";
import { FlagQueue } from "@/components/security/FlagQueue";
import { SecuritySettingsPanel } from "@/components/security/SecuritySettingsPanel";
import { useRoles } from "@/hooks/use-roles";

export const Route = createFileRoute("/_authenticated/security")({
  head: () => ({ meta: [{ title: "Security — MatchPoint" }] }),
  component: SecurityPage,
});

function SecurityPage() {
  const { can } = useRoles();

  return (
    <RequireCapability
      capability="security.audit.view"
      title="Security"
      subtitle="Who did what, what looks wrong, and what the platform enforces."
    >
      <Link
        to="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to admin
      </Link>

      <div className="space-y-6">
        <FlagQueue canManage={can("security.flags.manage")} />
        <SecuritySettingsPanel canEdit={can("security.settings")} />
        <AuditTable />
      </div>
    </RequireCapability>
  );
}

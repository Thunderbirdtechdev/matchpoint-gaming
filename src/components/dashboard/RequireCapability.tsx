/**
 * Module 7 — the one staff-page gate.
 *
 * Every staff route used to hand-roll this, and each did it slightly
 * differently: `if (roles && !isAdmin) return <p>You don't have admin access.</p>`
 * inside a shell, with no loading state and a message that named the role rather
 * than the permission.
 *
 * The denial below waits for roles to actually resolve — rendering it while the
 * query is still pending made every staff page flash "no access" on first paint.
 */

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { IconTile } from "@/components/ui/icon-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/hooks/use-roles";
import {
  APP_ROLES,
  CAPABILITY_LABELS,
  ROLE_CAPABILITIES,
  ROLE_LABELS,
  type AppRole,
  type Capability,
} from "@/lib/roles";

/** Which roles carry a capability — used to tell the user who to ask. */
function rolesGranting(capability: Capability): AppRole[] {
  return APP_ROLES.filter((r) => r !== "user" && ROLE_CAPABILITIES[r].includes(capability));
}

export function RequireCapability({
  capability,
  anyOf,
  title,
  subtitle,
  children,
}: {
  /** Single capability required to view the page. */
  capability?: Capability;
  /** Or: any one of these is enough. */
  anyOf?: Capability[];
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { can, canAny, isResolved, roles } = useRoles();

  const required = anyOf ?? (capability ? [capability] : []);
  const allowed = anyOf ? canAny(anyOf) : capability ? can(capability) : false;

  if (!isResolved) {
    return (
      <DashboardShell title={title} subtitle={subtitle}>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </DashboardShell>
    );
  }

  if (allowed) {
    return (
      <DashboardShell title={title} subtitle={subtitle}>
        {children}
      </DashboardShell>
    );
  }

  const granting = Array.from(new Set(required.flatMap(rolesGranting)));
  const held = roles.filter((r) => r !== "user");

  return (
    <DashboardShell title={title}>
      <div className="mx-auto max-w-lg rounded-2xl border border-border/60 bg-gradient-card p-8 text-center">
        <IconTile size="lg" className="mx-auto">
          <ShieldX className="h-6 w-6 text-muted-foreground" />
        </IconTile>

        <h2 className="mt-4 text-lg font-semibold">You don't have access to this page</h2>

        <p className="mt-2 text-sm text-muted-foreground">
          It needs the{" "}
          <span className="font-medium text-foreground">
            {required.map((c) => CAPABILITY_LABELS[c]).join(" or ")}
          </span>{" "}
          permission.
        </p>

        <div className="mt-5 space-y-1.5 rounded-xl border border-border/50 bg-surface/40 p-4 text-left text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Your roles</span>
            <span className="font-medium">
              {held.length ? held.map((r) => ROLE_LABELS[r]).join(", ") : "Player"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Granted by</span>
            <span className="font-medium">
              {granting.map((r) => ROLE_LABELS[r]).join(", ") || "-"}
            </span>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Ask a super admin to grant you one of those roles.
        </p>

        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </DashboardShell>
  );
}

/**
 * Module 7 — roles and capabilities.
 *
 * This file mirrors `role_capabilities` from
 * `20260903210000_role_hierarchy_and_capabilities.sql`.
 *
 * ⚠️ The DATABASE is the source of truth for enforcement. Every server function
 * asks Postgres via the `has_capability` RPC — never this map. What lives here
 * is for *rendering*: deciding which nav entries and buttons to draw without a
 * round trip per capability. A client that lies to itself here sees a button it
 * cannot use; it does not gain the permission.
 *
 * Keep the two in sync when adding a capability. `capabilityMapMatches()` below
 * exists so a mismatch surfaces as a console warning in dev rather than as a
 * button that silently does nothing.
 */

export const APP_ROLES = ["super_admin", "admin", "financial_admin", "moderator", "user"] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** Roles that grant staff tooling. `user` is everyone else. */
export const STAFF_ROLES = ["super_admin", "admin", "financial_admin", "moderator"] as const;

export type Capability =
  | "moderation.disputes.review"
  | "moderation.disputes.approve"
  | "moderation.tickets"
  | "moderation.evidence"
  | "moderation.tournaments.override"
  | "users.view"
  | "promo.manage"
  | "roles.view"
  | "roles.manage"
  | "roles.manage_privileged"
  | "platform.analytics"
  | "finance.view"
  | "finance.payouts"
  | "finance.treasury"
  | "finance.wallet_adjust";

export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  moderator: ["moderation.disputes.review", "moderation.tickets", "moderation.evidence"],

  admin: [
    "moderation.disputes.review",
    "moderation.disputes.approve",
    "moderation.tickets",
    "moderation.evidence",
    "moderation.tournaments.override",
    "users.view",
    "promo.manage",
    "roles.view",
    "roles.manage",
    "platform.analytics",
    "finance.view",
  ],

  financial_admin: [
    "users.view",
    "roles.view",
    "platform.analytics",
    "finance.view",
    "finance.payouts",
    "finance.treasury",
    "finance.wallet_adjust",
  ],

  super_admin: [
    "moderation.disputes.review",
    "moderation.disputes.approve",
    "moderation.tickets",
    "moderation.evidence",
    "moderation.tournaments.override",
    "users.view",
    "promo.manage",
    "roles.view",
    "roles.manage",
    "roles.manage_privileged",
    "platform.analytics",
    "finance.view",
    "finance.payouts",
    "finance.treasury",
    "finance.wallet_adjust",
  ],

  user: [],
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  financial_admin: "Financial admin",
  moderator: "Moderator",
  user: "Player",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin:
    "Both lanes, plus the only role that can appoint another privileged role. Keep this list short.",
  admin:
    "Platform operations — disputes, tickets, promo codes, moderators. Can see revenue but cannot move money.",
  financial_admin:
    "The treasury lane — payouts, bank sweeps, wallet adjustments. No dispute or support access.",
  moderator: "Front-line review of disputes and support tickets. Cannot approve a payout.",
  user: "No staff tooling.",
};

export const CAPABILITY_LABELS: Record<Capability, string> = {
  "moderation.disputes.review": "Review disputes",
  "moderation.disputes.approve": "Approve dispute payouts",
  "moderation.tickets": "Handle support tickets",
  "moderation.evidence": "View match evidence",
  "moderation.tournaments.override": "Override any tournament",
  "users.view": "Browse players",
  "promo.manage": "Manage promo codes",
  "roles.view": "View staff list",
  "roles.manage": "Grant moderator",
  "roles.manage_privileged": "Grant privileged roles",
  "platform.analytics": "Platform analytics",
  "finance.view": "View revenue",
  "finance.payouts": "Process player payouts",
  "finance.treasury": "Move company funds",
  "finance.wallet_adjust": "Adjust player wallets",
};

/** Capabilities grouped for display, in the order the admin UI shows them. */
export const CAPABILITY_GROUPS: { label: string; capabilities: Capability[] }[] = [
  {
    label: "Moderation",
    capabilities: [
      "moderation.disputes.review",
      "moderation.disputes.approve",
      "moderation.tickets",
      "moderation.evidence",
      "moderation.tournaments.override",
    ],
  },
  {
    label: "Platform",
    capabilities: ["users.view", "promo.manage", "platform.analytics"],
  },
  {
    label: "Finance",
    capabilities: ["finance.view", "finance.payouts", "finance.treasury", "finance.wallet_adjust"],
  },
  {
    label: "Roles",
    capabilities: ["roles.view", "roles.manage", "roles.manage_privileged"],
  },
];

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/** Union of everything the given roles allow. Unknown role strings are ignored. */
export function capabilitiesFor(roles: readonly string[] | null | undefined): Set<Capability> {
  const out = new Set<Capability>();
  for (const role of roles ?? []) {
    if (!isAppRole(role)) continue;
    for (const cap of ROLE_CAPABILITIES[role]) out.add(cap);
  }
  return out;
}

export function hasCapability(
  roles: readonly string[] | null | undefined,
  capability: Capability,
): boolean {
  return capabilitiesFor(roles).has(capability);
}

/**
 * Which roles this actor may grant or revoke.
 *
 * The important line is the second one: `roles.manage` alone yields ONLY
 * `moderator`. An admin must not be able to grant themselves financial_admin —
 * that would collapse the separation between the operations lane and the
 * treasury lane into a two-click self-promotion, and the whole module with it.
 *
 * Mirrored server-side in `authz.ts`; this copy only decides what the dropdown
 * offers.
 */
export function grantableRoles(caps: Set<Capability> | readonly Capability[]): AppRole[] {
  const set = caps instanceof Set ? caps : new Set(caps);
  if (set.has("roles.manage_privileged"))
    return ["super_admin", "admin", "financial_admin", "moderator"];
  if (set.has("roles.manage")) return ["moderator"];
  return [];
}

/**
 * Compares this file against the rows the database actually holds.
 * Called from the admin UI, which already loads `role_capabilities`, so a drift
 * between migration and mirror shows up as a warning instead of a mystery.
 */
export function capabilityMapMatches(
  rows: readonly { role: string; capability: string }[],
): { ok: true } | { ok: false; missingLocally: string[]; missingInDb: string[] } {
  const dbSet = new Set(rows.map((r) => `${r.role}:${r.capability}`));
  const localSet = new Set(
    APP_ROLES.flatMap((role) => ROLE_CAPABILITIES[role].map((cap) => `${role}:${cap}`)),
  );
  const missingLocally = [...dbSet].filter((k) => !localSet.has(k)).sort();
  const missingInDb = [...localSet].filter((k) => !dbSet.has(k)).sort();
  if (!missingLocally.length && !missingInDb.length) return { ok: true };
  return { ok: false, missingLocally, missingInDb };
}

/**
 * Module 7 — server-side authorization.
 *
 * Before this existed, every privileged server function carried its own copy of
 * an "is the caller an admin" check — three near-identical helpers in
 * admin.functions.ts alone, plus inline copies in payouts, promo, crypto and
 * matches. Each copy was a place to forget one.
 *
 * Everything here asks Postgres through the `has_capability` RPC, evaluated as
 * the CALLER (`context.supabase`, which carries the user's bearer token), never
 * the service-role client. Asking the service-role client would answer for the
 * wrong identity and quietly authorize everyone.
 */

import type { Capability } from "./roles";
import { APP_ROLES, type AppRole } from "./roles";

/**
 * The shape `requireSupabaseAuth` puts on a server function's context.
 *
 * `supabase` is deliberately untyped. The generated client types `rpc()` against
 * a literal union of known function names, and narrowing this to a structural
 * signature makes the real client unassignable to it. The project's existing
 * helpers took `{ supabase: any }` for the same reason.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type AuthContext = {
  supabase: any;
  userId: string;
};

/**
 * Thrown when the caller is authenticated but lacks the capability.
 * Distinct from an auth failure so a caller can tell "sign in" from "you can't".
 */
export class ForbiddenError extends Error {
  readonly capability: Capability;
  constructor(capability: Capability) {
    super(`Forbidden: this action requires the "${capability}" permission.`);
    this.name = "ForbiddenError";
    this.capability = capability;
  }
}

/** Does the caller hold this capability? Never throws for a plain "no". */
export async function can(ctx: AuthContext, capability: Capability): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_capability", {
    _user_id: ctx.userId,
    _capability: capability,
  } as never);
  if (error) throw error;
  return data === true;
}

/** Throws unless the caller holds the capability. The default guard. */
export async function requireCapability(ctx: AuthContext, capability: Capability): Promise<void> {
  if (!(await can(ctx, capability))) throw new ForbiddenError(capability);
}

/** Throws unless the caller holds at least one of the capabilities. */
export async function requireAnyCapability(
  ctx: AuthContext,
  capabilities: Capability[],
): Promise<void> {
  for (const capability of capabilities) {
    if (await can(ctx, capability)) return;
  }
  throw new ForbiddenError(capabilities[0]);
}

/** Every role held by a user, read with service-role rights. */
export async function rolesOf(admin: any, userId: string): Promise<AppRole[]> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[])
    .map((r) => r.role)
    .filter((r): r is AppRole => (APP_ROLES as readonly string[]).includes(r));
}

/**
 * Which roles this actor may grant or revoke — the server's copy of the rule in
 * `roles.ts`. Duplicated deliberately: the client copy decides what the dropdown
 * shows, this one decides what actually happens, and a compromised client can
 * only reach this one.
 *
 * `roles.manage` yields ONLY `moderator`. An admin granting themselves
 * `financial_admin` would erase the operations/treasury split that is the whole
 * point of the module, so that power sits behind `roles.manage_privileged`,
 * which only `super_admin` holds.
 */
export async function grantableRolesFor(ctx: AuthContext): Promise<AppRole[]> {
  if (await can(ctx, "roles.manage_privileged")) {
    return ["super_admin", "admin", "financial_admin", "moderator"];
  }
  if (await can(ctx, "roles.manage")) return ["moderator"];
  return [];
}

/** Throws unless the actor is allowed to grant or revoke this specific role. */
export async function requireCanManageRole(ctx: AuthContext, role: AppRole): Promise<void> {
  const allowed = await grantableRolesFor(ctx);
  if (allowed.includes(role)) return;
  if (!allowed.length) throw new ForbiddenError("roles.manage");
  throw new Error(
    `You can't manage the "${role}" role. Your account may grant: ${allowed.join(", ")}.`,
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

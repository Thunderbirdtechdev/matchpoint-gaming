/**
 * Module 7 — one place the client asks "what may I do?".
 *
 * Replaces five separate copies of the same inline `user_roles` query that had
 * drifted apart across admin, analytics, payouts, moderator and dispute-center.
 *
 * This decides what to RENDER. Enforcement lives in the server functions and in
 * RLS — a user who forces `can()` to return true here gets a button that fails
 * on click, not a permission.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  capabilitiesFor,
  grantableRoles,
  type AppRole,
  type Capability,
  APP_ROLES,
} from "@/lib/roles";

export function useRoles() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  const roles = useMemo(
    () =>
      (query.data ?? []).filter((r): r is AppRole => (APP_ROLES as readonly string[]).includes(r)),
    [query.data],
  );

  const capabilities = useMemo(() => capabilitiesFor(roles), [roles]);

  return useMemo(
    () => ({
      roles,
      capabilities,
      /** True only once the roles have actually loaded. */
      can: (capability: Capability) => capabilities.has(capability),
      canAny: (caps: Capability[]) => caps.some((c) => capabilities.has(c)),
      grantable: grantableRoles(capabilities),
      isStaff: roles.some((r) => r !== "user"),
      /**
       * Distinguishes "still loading" from "loaded, and you have nothing".
       * Guards must wait for this before rendering a denial, otherwise every
       * staff page flashes "no access" on first paint.
       */
      isResolved: query.isSuccess,
      isLoading: query.isPending,
    }),
    [roles, capabilities, query.isSuccess, query.isPending],
  );
}

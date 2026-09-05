/**
 * Module 9 — does this session still owe a second factor?
 *
 * Separate from `MfaChallenge` so that component file exports only a component,
 * which is what keeps fast refresh working.
 *
 * `getAuthenticatorAssuranceLevel()` is the right question to ask, rather than
 * listing factors and inferring. It reports `nextLevel: "aal2"` exactly when
 * the account has a verified factor and the current session has not yet used
 * it, which is the condition a challenge exists to clear.
 */

import { supabase } from "@/integrations/supabase/client";

/**
 * Returns false on any error.
 *
 * A challenge that cannot be established must not become a locked door in front
 * of someone whose password was already accepted. The money actions stay
 * refused either way — `assertMfaForSensitiveAction` checks the claim on the
 * server, not this — so failing open costs nothing here, while failing closed
 * would strand people on a screen they have no way to pass.
 */
export async function needsMfaChallenge(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    return false;
  }
}

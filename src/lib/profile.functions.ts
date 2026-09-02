import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkEligibility } from "./eligibility";

const ConfirmEligibilitySchema = z.object({
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  country: z.string().trim().length(2).toUpperCase(),
});

/**
 * Record a player's self-attested date of birth and country, and stamp
 * `age_confirmed_at` only if they actually pass the gate.
 *
 * The check runs here rather than in the browser because the client could
 * otherwise write `age_confirmed_at` itself — RLS lets a user update their own
 * verification row, so it can police *whose* row is written but not whether the
 * date inside it clears the age bar.
 */
export const confirmEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ConfirmEligibilitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const result = checkEligibility(data.date_of_birth, data.country);

    const { error } = await supabaseAdmin.from("player_verification").upsert(
      {
        user_id: context.userId,
        date_of_birth: data.date_of_birth,
        country: data.country,
        age_confirmed_at: result.eligible ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) throw new Error(error.message);

    if (!result.eligible) {
      return { eligible: false as const, reason: result.reason };
    }
    return { eligible: true as const };
  });

const UpdateProfileSchema = z.object({
  display_name: z.string().trim().max(60).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(24, "At most 24 characters")
    .regex(/^[a-z0-9_]+$/, "Letters, numbers and underscores only")
    .optional(),
  bio: z.string().trim().max(400).optional(),
  favorite_game: z.string().trim().max(60).optional(),
  platform: z.string().trim().max(40).optional(),
  region: z.string().trim().max(60).optional(),
});

/**
 * Update the public half of a profile. Goes through the server so the username
 * uniqueness clash comes back as a readable message rather than a raw Postgres
 * constraint error.
 */
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.username) {
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", data.username)
        .neq("id", context.userId)
        .maybeSingle();
      if (taken) throw new Error("That username is already taken.");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

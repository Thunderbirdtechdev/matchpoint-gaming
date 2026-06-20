import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const JoinSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  source: z.string().trim().max(64).optional(),
  referrer: z.string().trim().max(512).optional(),
});

/** Public: anyone can add their email to the launch waitlist. */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d) => JoinSchema.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { error } = await supabase.from("waitlist_signups").insert({
      email: data.email,
      source: data.source ?? "overlay",
      referrer: data.referrer ?? null,
    });

    // 23505 = unique violation → treat duplicates as success.
    if (error && (error as any).code !== "23505") {
      throw new Error(error.message);
    }

    return { ok: true } as const;
  });

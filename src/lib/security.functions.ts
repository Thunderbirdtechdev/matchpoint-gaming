/**
 * Module 9 — Security, audit and compliance server functions.
 *
 * Reads are gated on `security.audit.view`, which admin, financial_admin and
 * super_admin all hold. That breadth is deliberate: an audit trail only one
 * lane can read is not an audit trail — the treasury lane has to be able to see
 * what operations did to a wallet, and operations has to be able to see a
 * sweep. Acting on a flag needs `security.flags.manage`; changing what the
 * platform enforces needs `security.settings`, which only super_admin holds.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCapability } from "@/lib/authz";
import { BLOCKED_COUNTRIES, MIN_AGE, ageInYears } from "@/lib/eligibility";
import type { Json } from "@/integrations/supabase/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const AuditQuerySchema = z.object({
  /** Matches the dotted prefix, e.g. "finance" for every treasury action. */
  lane: z.enum(["all", "finance", "moderation", "roles", "promo", "security"]).default("all"),
  actor_id: z.string().uuid().optional(),
  target_id: z.string().optional(),
  /** Inclusive YYYY-MM-DD bounds. */
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().trim().max(120).optional(),
  /** Keyset cursor: the id of the last row already shown. */
  before_id: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type AuditRow = {
  id: number;
  created_at: string;
  actor_id: string | null;
  actor_label: string | null;
  actor_roles: string[] | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  summary: string;
  amount_cents: number | null;
  // `Json`, not Record<string, unknown>: TanStack Start type-checks a server
  // function's return value for serializability, and `unknown` fails it.
  metadata: Json;
  ip: string | null;
};

/**
 * One page of the audit log, newest first.
 *
 * Keyset pagination on the BIGSERIAL id rather than OFFSET. The log is
 * append-only and read newest-first, so with OFFSET a row written between two
 * page fetches shifts everything down and the reader silently sees a duplicate
 * on page 2 and misses one entirely — in an audit trail, "you were shown 49 of
 * 50 rows and told nothing" is the failure that matters.
 */
export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => AuditQuerySchema.parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "security.audit.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("audit_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(data.limit + 1); // one extra row: tells us whether a next page exists

    if (data.lane !== "all") q = q.like("action", `${data.lane}.%`);
    if (data.actor_id) q = q.eq("actor_id", data.actor_id);
    if (data.target_id) q = q.eq("target_id", data.target_id);
    if (data.from) q = q.gte("created_at", `${data.from}T00:00:00.000Z`);
    if (data.to) {
      // Exclusive bound one day past `to`, so the end date is fully included.
      const end = new Date(`${data.to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      q = q.lt("created_at", end.toISOString());
    }
    if (data.search) q = q.ilike("summary", `%${data.search}%`);
    if (data.before_id) q = q.lt("id", data.before_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as unknown as AuditRow[];
    const has_more = list.length > data.limit;
    const page = has_more ? list.slice(0, data.limit) : list;

    return {
      rows: page,
      has_more,
      next_cursor: has_more ? page[page.length - 1].id : null,
    };
  });

// ---------------------------------------------------------------------------
// Security settings
// ---------------------------------------------------------------------------

export const getSecuritySettingsForUi = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "security.audit.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("security_settings")
      .select("key, value, description, updated_at, updated_by")
      .order("key");
    if (error) throw new Error(error.message);

    return ((data ?? []) as any[]).map((r) => ({
      key: String(r.key),
      value: r.value === true || r.value === "true",
      description: r.description as string | null,
      updated_at: r.updated_at as string,
      updated_by: r.updated_by as string | null,
    }));
  });

const SETTING_KEYS = [
  "enforce_blocked_jurisdictions",
  "require_eligibility_confirmed",
  "require_mfa_for_treasury",
] as const;

/**
 * Flip one switch.
 *
 * Audited unconditionally, and the audit entry is the point: switching
 * jurisdiction enforcement off is exactly the action someone would take to make
 * a prohibited transaction possible, so it must leave a record naming who did
 * it. That record lands in a log they cannot edit.
 */
export const updateSecuritySetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.enum(SETTING_KEYS), value: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "security.settings");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: before } = await supabaseAdmin
      .from("security_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("security_settings")
      .update({
        value: data.value as never,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      } as never)
      .eq("key", data.key);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/audit.server");
    const audit = await recordAudit(context.userId, {
      action: "security.setting_change",
      target_type: "setting",
      target_id: data.key,
      summary: `Turned ${data.key.replace(/_/g, " ")} ${data.value ? "ON" : "OFF"}`,
      metadata: { key: data.key, from: (before as any)?.value ?? null, to: data.value },
    });

    return { ok: true, audit_failed: !audit.ok };
  });

// ---------------------------------------------------------------------------
// Suspicious activity
// ---------------------------------------------------------------------------

export type SecurityFlagRow = {
  id: string;
  kind: string;
  dedupe_key: string;
  severity: "low" | "medium" | "high";
  subject_user_id: string | null;
  title: string;
  detail: Json;
  magnitude: number;
  status: "open" | "acknowledged" | "dismissed" | "actioned";
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
};

export const listSecurityFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["open", "acknowledged", "dismissed", "actioned", "all"]).default("open"),
        limit: z.number().int().min(1).max(200).default(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "security.audit.view");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("security_flags")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Severity is stored as text, so ordering it in SQL sorts alphabetically —
    // high, low, medium — which would bury the high-severity findings in the
    // middle of the queue. Ranked here instead.
    const RANK = { high: 0, medium: 1, low: 2 } as const;
    const flags = ((rows ?? []) as unknown as SecurityFlagRow[]).sort(
      (a, b) =>
        (RANK[a.severity] ?? 3) - (RANK[b.severity] ?? 3) ||
        b.last_seen_at.localeCompare(a.last_seen_at),
    );

    // Resolve every user id mentioned — as a subject, or inside a group finding
    // like a shared payout handle. A queue of bare uuids is not triageable.
    const ids = new Set<string>();
    for (const f of flags) {
      if (f.subject_user_id) ids.add(f.subject_user_id);
      for (const key of ["user_ids"]) {
        const v = (f.detail as any)?.[key];
        if (Array.isArray(v)) for (const u of v) if (typeof u === "string") ids.add(u);
      }
    }
    const names: Record<string, string> = {};
    if (ids.size) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, username, display_name")
        .in("id", [...ids]);
      for (const p of (profiles ?? []) as any[]) {
        names[p.id] = p.display_name || p.username || p.id.slice(0, 8);
      }
    }

    return { flags, names };
  });

/** Severity and wording for each detector. Kept in one place so the queue reads consistently. */
const FLAG_META: Record<
  string,
  { title: (d: any) => string; severity: (d: any, magnitude: number) => "low" | "medium" | "high" }
> = {
  rapid_cashout: {
    title: (d) => `Deposited and cashed out within ${d.window_hours}h (${d.pairs}×)`,
    severity: (_d, m) => (m >= 3 ? "high" : "medium"),
  },
  shared_payout_handle: {
    title: (d) => `${d.account_count} accounts share one ${d.handle_kind} payout destination`,
    severity: (_d, m) => (m >= 3 ? "high" : "medium"),
  },
  repeat_disputes: {
    title: (d) => `${d.disputes} disputes opened in ${d.window_days} days`,
    severity: (_d, m) => (m >= 6 ? "high" : "medium"),
  },
  collusion_pair: {
    title: (d) =>
      `Same two players ${d.matches}×, ${Math.round(Number(d.one_sidedness) * 100)}% one-sided`,
    severity: (d, m) => (m >= 8 || Number(d.one_sidedness) === 1 ? "high" : "medium"),
  },
  self_dealing: {
    title: (d) => `Staff account acted on its own account ${d.events}×`,
    // Always high. There is no benign volume of an admin crediting their own
    // wallet, so this must never be filtered out as low-priority noise.
    severity: () => "high",
  },
  blocked_jurisdiction: {
    title: (d) => `Account registered in a blocked country (${d.country_name})`,
    severity: () => "high",
  },
  underage: {
    title: (d) => `Account records an age under ${MIN_AGE} (${d.age})`,
    severity: () => "high",
  },
};

/**
 * Run every detector and fold the results into the flag queue.
 *
 * Triggered by a person from `/security` rather than on a schedule: there is no
 * cron in this stack, and a scan that only runs when someone is looking at the
 * queue is honest about that rather than implying continuous monitoring that
 * does not exist. The page says when the last scan ran.
 */
export const runSecurityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireCapability(context, "security.flags.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: candidates, error } = await supabaseAdmin.rpc(
      "security_scan_candidates" as never,
    );
    if (error) throw new Error(error.message);

    type Candidate = {
      kind: string;
      dedupe_key: string;
      subject_user_id: string | null;
      magnitude: number;
      detail: Record<string, unknown>;
    };
    const found: Candidate[] = ((candidates ?? []) as any[]).map((c) => ({
      kind: String(c.kind),
      dedupe_key: String(c.dedupe_key),
      subject_user_id: (c.subject_user_id as string | null) ?? null,
      magnitude: Number(c.magnitude),
      detail: (c.detail ?? {}) as Record<string, unknown>,
    }));

    // The jurisdiction detector runs here rather than in SQL so that
    // BLOCKED_COUNTRIES and the age floor have exactly one home
    // (src/lib/eligibility.ts). A second copy of a sanctions list in a
    // migration is a copy that will eventually disagree with the first, and the
    // disagreement would be invisible until it mattered.
    const { data: verifications } = await supabaseAdmin
      .from("player_verification")
      .select("user_id, country, date_of_birth");

    for (const v of (verifications ?? []) as any[]) {
      const country = (v.country as string | null)?.toUpperCase() ?? null;
      if (country && BLOCKED_COUNTRIES[country]) {
        found.push({
          kind: "blocked_jurisdiction",
          dedupe_key: String(v.user_id),
          subject_user_id: String(v.user_id),
          magnitude: 1,
          detail: { country, country_name: BLOCKED_COUNTRIES[country] },
        });
      }
      if (v.date_of_birth) {
        const age = ageInYears(String(v.date_of_birth));
        if (!Number.isNaN(age) && age >= 0 && age < MIN_AGE) {
          found.push({
            kind: "underage",
            dedupe_key: String(v.user_id),
            subject_user_id: String(v.user_id),
            magnitude: MIN_AGE - age,
            detail: { age, minimum: MIN_AGE },
          });
        }
      }
    }

    let recorded = 0;
    const failures: string[] = [];
    const highSeverity: string[] = [];
    for (const c of found) {
      const meta = FLAG_META[c.kind];
      if (!meta) continue;
      const severity = meta.severity(c.detail, c.magnitude);
      if (severity === "high") highSeverity.push(meta.title(c.detail));
      const { error: upsertErr } = await supabaseAdmin.rpc(
        "security_record_flag" as never,
        {
          _kind: c.kind,
          _dedupe_key: c.dedupe_key,
          _subject_user_id: c.subject_user_id,
          _severity: severity,
          _title: meta.title(c.detail),
          _detail: c.detail,
          _magnitude: c.magnitude,
        } as never,
      );
      if (upsertErr) failures.push(`${c.kind}/${c.dedupe_key}: ${upsertErr.message}`);
      else recorded += 1;
    }

    const scanned_at = new Date().toISOString();

    const { recordAudit } = await import("@/lib/audit.server");
    await recordAudit(context.userId, {
      action: "security.scan_run",
      summary: `Ran the suspicious-activity scan — ${recorded} finding(s) recorded`,
      metadata: { recorded, failures: failures.length, high: highSeverity.length },
    });

    /*
     * Module 10. Module 9 shipped this queue with no way to learn about it
     * except by opening the page, which meant a staff account crediting its own
     * wallet could sit unread indefinitely.
     *
     * HIGH SEVERITY ONLY. Mailing medium and low findings would teach people to
     * filter these away, and an alert that gets filtered is worse than no alert
     * at all: it leaves everyone believing somebody is watching.
     *
     * Recipients resolve by CAPABILITY, not a hardcoded list, so a role added
     * later starts receiving these without anyone remembering to come back here.
     */
    let alerted = 0;
    if (highSeverity.length) {
      const { notifyStaffWithCapability, notifyKey } = await import("@/lib/email/notify.server");
      alerted = await notifyStaffWithCapability(
        "security.flags.manage",
        "security-alert",
        {
          findingTitle: highSeverity[0],
          totalHigh: highSeverity.length,
          scannedAt: new Date(scanned_at).toUTCString(),
        },
        // Keyed to the hour, so re-running the scan a minute later does not
        // re-alert for findings nobody has had a chance to look at yet.
        notifyKey("security-alert", scanned_at.slice(0, 13), highSeverity.length),
      );
    }

    return { scanned_at, recorded, failures, high: highSeverity.length, alerted };
  });

/**
 * Triage one flag.
 *
 * A dismissal records the magnitude it was dismissed AT, which is what lets the
 * scanner leave it alone afterwards without burying a finding that later grows.
 */
export const triageSecurityFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["open", "acknowledged", "dismissed", "actioned"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "security.flags.manage");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: flag, error: readErr } = await supabaseAdmin
      .from("security_flags")
      .select("kind, title, magnitude, status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!flag) throw new Error("That flag no longer exists.");

    const closing = data.status === "dismissed" || data.status === "actioned";

    const { error } = await supabaseAdmin
      .from("security_flags")
      .update({
        status: data.status,
        resolution_note: data.note ?? null,
        resolved_by: closing ? context.userId : null,
        resolved_at: closing ? new Date().toISOString() : null,
        // Only a dismissal sets the high-water mark. 'actioned' means someone
        // dealt with it, so if the same pattern recurs at any size it should
        // come back — leaving this null makes the scanner reopen it on growth
        // past its current magnitude, which is the closest honest equivalent.
        dismissed_magnitude: data.status === "dismissed" ? (flag as any).magnitude : null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { recordAudit } = await import("@/lib/audit.server");
    const audit = await recordAudit(context.userId, {
      action: "security.flag_triage",
      target_type: "flag",
      target_id: data.id,
      target_label: (flag as any).title,
      summary: `Marked "${(flag as any).title}" as ${data.status}`,
      metadata: {
        kind: (flag as any).kind,
        from: (flag as any).status,
        to: data.status,
        note: data.note ?? null,
      },
    });

    return { ok: true, audit_failed: !audit.ok };
  });

// ---------------------------------------------------------------------------
// Two-factor authentication
// ---------------------------------------------------------------------------

/**
 * Second-factor enrolment for a set of staff accounts.
 *
 * Goes through `admin_mfa_status`, a SECURITY DEFINER function over
 * auth.mfa_factors, rather than the GoTrue admin API — that API answers for one
 * user per HTTP call, so a staff list of twelve would be twelve round trips
 * before the page could render.
 */
export const listMfaStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireCapability(context, "roles.view");
    if (!data.user_ids.length) return {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc(
      "admin_mfa_status" as never,
      {
        _user_ids: data.user_ids,
      } as never,
    );
    if (error) throw new Error(error.message);

    const out: Record<string, { enrolled: boolean; verified: number }> = {};
    for (const r of (rows ?? []) as any[]) {
      out[String(r.user_id)] = {
        enrolled: Number(r.verified_count) > 0,
        verified: Number(r.verified_count),
      };
    }
    return out;
  });

/**
 * Remove another user's second factor.
 *
 * The recovery path, and the reason requiring 2FA for treasury is safe to turn
 * on: a lost authenticator would otherwise permanently strip the treasury
 * controls from that account, with no way back that does not involve the
 * database. super_admin only, and audited — this is also the exact move an
 * attacker with an admin session would make to weaken an account before taking
 * it over, so the record of it matters as much as the ability.
 */
export const adminResetUserMfa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({ user_id: z.string().uuid(), reason: z.string().trim().max(200).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireCapability(context, "security.settings");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: factors, error: listErr } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: data.user_id,
    });
    if (listErr) throw new Error(listErr.message);

    const all = (factors as any)?.factors ?? [];
    let removed = 0;
    for (const f of all as { id: string }[]) {
      const { error: delErr } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: f.id,
        userId: data.user_id,
      });
      if (delErr) throw new Error(delErr.message);
      removed += 1;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("username, display_name")
      .eq("id", data.user_id)
      .maybeSingle();

    const { recordAudit } = await import("@/lib/audit.server");
    const audit = await recordAudit(context.userId, {
      action: "security.mfa_reset",
      target_type: "user",
      target_id: data.user_id,
      target_label:
        ((profile as any)?.display_name || (profile as any)?.username) ?? data.user_id.slice(0, 8),
      summary: `Removed ${removed} second factor(s)`,
      metadata: { removed, reason: data.reason ?? null },
    });

    return { ok: true, removed, audit_failed: !audit.ok };
  });
/* eslint-enable @typescript-eslint/no-explicit-any */

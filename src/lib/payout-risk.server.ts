/**
 * Fair-play checks for payout review. Flags look for bonus farming: a player
 * wins against a fresh, never-deposited account in a very fast match.
 * Flags are advisory — they never block a payout, they warn the admin.
 */
export type RiskFlag = { code: string; label: string; detail: string };

const NEW_ACCOUNT_MIN = 60;
const FAST_MATCH_MIN = 3;
const REPEAT_OPPONENT = 3;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computePayoutRisk(admin: any, userIds: string[]) {
  const out = new Map<string, RiskFlag[]>();
  if (!userIds.length) return out;
  const ids = userIds.join(",");
  const { data: chals } = await admin
    .from("challenges")
    .select("id, creator_id, opponent_id, winner_id, status, created_at, updated_at")
    .eq("status", "completed")
    .or(`creator_id.in.(${ids}),opponent_id.in.(${ids})`)
    .limit(2000);
  const list = (chals ?? []) as Array<{
    creator_id: string;
    opponent_id: string | null;
    winner_id: string | null;
    created_at: string;
    updated_at: string;
  }>;

  const oppIds = new Set<string>();
  for (const c of list) {
    if (c.opponent_id) oppIds.add(c.opponent_id);
    oppIds.add(c.creator_id);
  }
  const opps = Array.from(oppIds);
  const [{ data: profs }, { data: deps }] = await Promise.all([
    admin.from("profiles").select("id, username, created_at").in("id", opps),
    admin.from("wallet_transactions").select("user_id").eq("type", "deposit").eq("status", "completed").in("user_id", opps),
  ]);
  const profById = new Map<string, { username: string | null; created_at: string }>(
    (profs ?? []).map((p: { id: string; username: string | null; created_at: string }) => [p.id, p]),
  );
  const depositors = new Set((deps ?? []).map((d: { user_id: string }) => d.user_id));

  for (const uid of userIds) {
    const flags: RiskFlag[] = [];
    const mine = list.filter((c) => c.creator_id === uid || c.opponent_id === uid);
    const wins = mine.filter((c) => c.winner_id === uid);
    const name = (id: string) => "@" + (profById.get(id)?.username ?? id.slice(0, 8));
    const newOpp = new Set<string>();
    const noDep = new Set<string>();
    let fast = 0;
    for (const c of wins) {
      const opp = c.creator_id === uid ? c.opponent_id : c.creator_id;
      if (!opp) continue;
      const p = profById.get(opp);
      if (p) {
        const ageMin = (new Date(c.created_at).getTime() - new Date(p.created_at).getTime()) / 60000;
        if (ageMin < NEW_ACCOUNT_MIN) newOpp.add(opp);
      }
      if (!depositors.has(opp)) noDep.add(opp);
      const durMin = (new Date(c.updated_at).getTime() - new Date(c.created_at).getTime()) / 60000;
      if (durMin < FAST_MATCH_MIN) fast++;
    }
    if (newOpp.size)
      flags.push({ code: "new_opponent", label: "New-account opponent", detail: `Beat account(s) created under ${NEW_ACCOUNT_MIN} min before the match: ${[...newOpp].map(name).join(", ")}` });
    if (noDep.size)
      flags.push({ code: "bonus_only_opponent", label: "Bonus-only opponent", detail: `Beat player(s) who never deposited: ${[...noDep].map(name).join(", ")}` });
    if (fast)
      flags.push({ code: "fast_match", label: "Very fast match", detail: `${fast} win(s) finished in under ${FAST_MATCH_MIN} minutes` });
    const counts = new Map<string, number>();
    for (const c of mine) {
      const opp = c.creator_id === uid ? c.opponent_id : c.creator_id;
      if (opp) counts.set(opp, (counts.get(opp) ?? 0) + 1);
    }
    const repeats = [...counts].filter(([, n]) => n >= REPEAT_OPPONENT);
    if (repeats.length)
      flags.push({ code: "repeat_opponent", label: "Same opponent repeatedly", detail: repeats.map(([id, n]) => `${name(id)} ×${n}`).join(", ") });
    out.set(uid, flags);
  }
  return out;
}

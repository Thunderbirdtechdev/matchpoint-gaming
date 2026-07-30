import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Pill, Button, Empty, Divider, styles_shared } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Tab =
  | "overview" | "users" | "transactions" | "tournaments"
  | "challenges" | "disputes" | "tickets" | "reports" | "revenue" | "ads";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "users", label: "Users", icon: "people" },
  { key: "transactions", label: "Transactions", icon: "swap-horizontal" },
  { key: "tournaments", label: "Tournaments", icon: "trophy" },
  { key: "challenges", label: "Challenges", icon: "flash" },
  { key: "disputes", label: "Disputes", icon: "warning" },
  { key: "tickets", label: "Tickets", icon: "chatbubbles" },
  { key: "reports", label: "Reports", icon: "flag" },
  { key: "revenue", label: "Revenue", icon: "cash" },
  { key: "ads", label: "Ads", icon: "megaphone" },
];

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTicket, setActiveTicket] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      if (tab === "overview") setData(await api("/admin/overview"));
      else if (tab === "users") setData(await api("/admin/users"));
      else if (tab === "transactions") setData(await api("/admin/transactions"));
      else if (tab === "tournaments") setData(await api("/admin/tournaments"));
      else if (tab === "challenges") setData(await api("/admin/challenges"));
      else if (tab === "disputes") setData(await api("/admin/disputes"));
      else if (tab === "tickets") setData(await api("/admin/tickets"));
      else if (tab === "reports") setData(await api("/admin/reports"));
      else if (tab === "revenue") setData(await api("/admin/revenue"));
      else if (tab === "ads") setData(await api("/admin/ads"));
    } catch (e) { console.log(e); }
  }, [tab]);

  // Reset data on tab change so a previous tab's shape can't crash the new renderer
  useEffect(() => { setData(null); }, [tab]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user?.is_admin) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.error }}>Admin access required</Text></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity testID="admin-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.title}>ADMIN CONSOLE</Text>
            <Text style={styles.subtitle}>Company-only</Text>
          </View>
          <TouchableOpacity onPress={onRefresh}><Ionicons name="refresh" size={22} color={colors.onSurface} /></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} testID={`admin-tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.chip, tab === t.key && styles.chipActive]}>
              <Ionicons name={t.icon} size={14} color={tab === t.key ? colors.brand : colors.onSurfaceSecondary} />
              <Text style={[styles.chipLabel, tab === t.key && styles.chipLabelActive]}>{t.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {tab === "overview" && data && <OverviewTab data={data} />}
        {tab === "users" && Array.isArray(data) && <UsersTab users={data} onChange={load} />}
        {tab === "transactions" && Array.isArray(data) && <TransactionsTab txs={data} />}
        {tab === "tournaments" && Array.isArray(data) && <TournamentsTab items={data} />}
        {tab === "challenges" && Array.isArray(data) && <ChallengesTab items={data} />}
        {tab === "disputes" && data && <DisputesTab data={data} onChange={load} />}
        {tab === "tickets" && Array.isArray(data) && <TicketsTab tickets={data} onOpen={setActiveTicket} />}
        {tab === "reports" && Array.isArray(data) && <ReportsTab reports={data} onChange={load} />}
        {tab === "revenue" && Array.isArray(data) && <RevenueTab items={data} />}
        {tab === "ads" && Array.isArray(data) && <AdsTab items={data} onChange={load} />}
      </ScrollView>

      {activeTicket && <TicketModal ticket={activeTicket} onClose={() => { setActiveTicket(null); load(); }} />}
    </View>
  );
}

// ------------------- Overview -------------------
function OverviewTab({ data }: { data: any }) {
  const k = data.kpis || {};
  const rev = data.revenue_by_type || [];
  const ts = data.timeseries || [];
  const maxRev = Math.max(1, ...ts.map((t: any) => t.revenue));
  return (
    <>
      <View style={styles.kpiGrid}>
        <Kpi label="TOTAL REVENUE" value={`$${(k.total_revenue || 0).toFixed(2)}`} tone="brand" testID="kpi-total-revenue" />
        <Kpi label="REVENUE 24H" value={`$${(k.revenue_24h || 0).toFixed(2)}`} />
        <Kpi label="REVENUE 7D" value={`$${(k.revenue_7d || 0).toFixed(2)}`} />
        <Kpi label="OPEN DISPUTES" value={k.disputed_challenges || 0} tone={k.disputed_challenges > 0 ? "danger" : undefined} />
        <Kpi label="OPEN TICKETS" value={k.open_tickets || 0} tone={k.open_tickets > 0 ? "warning" : undefined} />
        <Kpi label="OPEN REPORTS" value={k.open_reports || 0} tone={k.open_reports > 0 ? "warning" : undefined} />
        <Kpi label="TOTAL USERS" value={k.total_users || 0} />
        <Kpi label="NEW USERS 24H" value={k.new_users_24h || 0} />
        <Kpi label="NEW USERS 7D" value={k.new_users_7d || 0} />
        <Kpi label="DAU" value={k.dau || 0} />
        <Kpi label="MAU" value={k.mau || 0} />
        <Kpi label="SUSPENDED" value={k.suspended_users || 0} tone={k.suspended_users > 0 ? "danger" : undefined} />
        <Kpi label="ACTIVE H2H" value={k.active_challenges || 0} />
        <Kpi label="ACTIVE TOURNEYS" value={k.active_tournaments || 0} />
        <Kpi label="DEPOSITS" value={`$${(k.total_deposits || 0).toFixed(2)}`} sub={`${k.deposit_count || 0} txns`} />
        <Kpi label="WITHDRAWALS" value={`$${(k.total_withdrawals || 0).toFixed(2)}`} sub={`${k.withdrawal_count || 0} txns`} />
        <Kpi label="PENDING WD" value={k.pending_withdrawals || 0} tone={k.pending_withdrawals > 0 ? "warning" : undefined} />
        <Kpi label="FINALIZED" value={k.finalized_challenges || 0} />
      </View>
      <Card>
        <Text style={styles.section}>7-DAY REVENUE</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6, marginTop: spacing.md }}>
          {ts.map((d: any, i: number) => {
            const h = Math.max(4, (d.revenue / maxRev) * 110);
            return (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                <Text style={{ color: colors.brand, fontSize: 9, fontWeight: "700" }}>${d.revenue.toFixed(0)}</Text>
                <View style={{ width: "100%", height: h, backgroundColor: colors.brand, borderRadius: 4 }} />
                <Text style={{ color: colors.onSurfaceTertiary, fontSize: 9 }}>{d.date.slice(5)}</Text>
              </View>
            );
          })}
        </View>
      </Card>
      <Card>
        <Text style={styles.section}>REVENUE BY SOURCE</Text>
        {rev.length === 0 ? <Text style={styles.dim}>No revenue yet.</Text> : rev.map((r: any) => (
          <View key={r.type} style={styles.row}>
            <Text style={styles.rowLabel}>{r.type?.replace(/_/g, " ")}</Text>
            <Text style={styles.rowSub}>{r.count} txns</Text>
            <Text style={styles.rowVal}>${r.total.toFixed(2)}</Text>
          </View>
        ))}
      </Card>
    </>
  );
}

function Kpi({ label, value, sub, tone, testID }: any) {
  const color = tone === "brand" ? colors.brand : tone === "danger" ? colors.error : tone === "warning" ? colors.warning : colors.onSurface;
  return (
    <View testID={testID} style={styles.kpi}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub}>{sub}</Text> : null}
    </View>
  );
}

// ------------------- Users -------------------
function UsersTab({ users, onChange }: any) {
  const [q, setQ] = useState("");
  const filtered = users.filter((u: any) => !q || u.username?.toLowerCase().includes(q.toLowerCase()) || u.email?.toLowerCase().includes(q.toLowerCase()));
  const toggle = async (u: any) => { await api(`/admin/users/${u.id}/${u.suspended ? "unsuspend" : "suspend"}`, { method: "POST" }); onChange(); };
  return (
    <>
      <TextInput testID="admin-user-search" style={styles_shared.input} value={q} onChangeText={setQ} placeholder="Search username or email" placeholderTextColor={colors.onSurfaceTertiary} />
      {filtered.map((u: any) => (
        <Card key={u.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{u.username}{u.is_admin && <Text style={{ color: colors.brand }}> · ADMIN</Text>}</Text>
              <Text style={styles.rowSub}>{u.email}</Text>
              <Text style={styles.rowSub}>${(u.wallet_balance || 0).toFixed(2)} · {u.stats?.matches || 0} matches · rank {u.stats?.rank || 1500}</Text>
            </View>
            {u.suspended ? <Pill label="suspended" tone="danger" /> : <Pill label="active" tone="success" />}
            <TouchableOpacity onPress={() => toggle(u)} style={{ marginLeft: 8 }}>
              <Text style={{ color: u.suspended ? colors.success : colors.error, fontWeight: "800", fontSize: 12 }}>{u.suspended ? "UNSUSPEND" : "SUSPEND"}</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}
      {filtered.length === 0 && <Empty title="No users match" />}
    </>
  );
}

// ------------------- Transactions -------------------
function TransactionsTab({ txs }: { txs: any[] }) {
  return txs.length === 0 ? <Empty title="No transactions" /> : (
    <>
      {txs.map(t => (
        <Card key={t.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t.type?.replace(/_/g, " ").toUpperCase()}</Text>
              <Text style={styles.rowSub}>{t.username || t.user_id} · {new Date(t.created_at).toLocaleString()}</Text>
              {t.fee ? <Text style={styles.rowSub}>Fee ${t.fee?.toFixed(2)} · {t.tier || ""}</Text> : null}
              {t.speed ? <Text style={styles.rowSub}>Speed: {t.speed}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.rowVal, { color: (t.type === "withdrawal" || t.type === "tournament_entry") ? colors.error : colors.success }]}>
                {t.type === "withdrawal" || t.type === "tournament_entry" ? "-" : "+"}${Math.abs(t.amount || 0).toFixed(2)}
              </Text>
              <Pill label={t.status} tone={t.status === "completed" ? "success" : t.status === "processing" ? "warning" : "default"} />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

// ------------------- Tournaments -------------------
function TournamentsTab({ items }: { items: any[] }) {
  return items.length === 0 ? <Empty title="No tournaments" /> : items.map(t => (
    <Card key={t.id}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{t.name}</Text>
          <Text style={styles.rowSub}>{t.game} · {t.tournament_type} · {(t.registered || []).length}/{t.max_players}</Text>
          {t.sponsor ? <Text style={styles.rowSub}>Sponsor: {t.sponsor}</Text> : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.rowVal}>${(t.prize_pool || 0).toFixed(0)}</Text>
          <Pill label={t.status} tone={t.status === "open" ? "brand" : t.status === "completed" ? "success" : "warning"} />
        </View>
      </View>
    </Card>
  ));
}

// ------------------- Challenges -------------------
function ChallengesTab({ items }: { items: any[] }) {
  return items.length === 0 ? <Empty title="No challenges" /> : items.map(c => (
    <Card key={c.id}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{c.game} · ${(c.stake || 0).toFixed(0)}</Text>
          <Text style={styles.rowSub}>{c.creator_username} vs {c.opponent_username || "OPEN"}</Text>
          {c.winner_id ? <Text style={styles.rowSub}>Winner: {c.winner_id === c.creator_id ? c.creator_username : c.opponent_username}</Text> : null}
        </View>
        <Pill label={c.status} tone={c.status === "finalized" ? "success" : c.status === "disputed" ? "danger" : c.status === "cancelled" || c.status === "declined" ? "default" : "brand"} />
      </View>
    </Card>
  ));
}

// ------------------- Disputes -------------------
function DisputesTab({ data, onChange }: any) {
  const resolveCh = async (id: string, winner_id: string) => { await api(`/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ winner_id }) }); onChange(); };
  const resolveTm = async (t_id: string, m_id: string, winner_id: string) => { await api(`/admin/tournaments/${t_id}/matches/${m_id}/resolve`, { method: "POST", body: JSON.stringify({ winner_id }) }); onChange(); };
  return (
    <>
      <Text style={styles.subheader}>H2H CHALLENGES</Text>
      {(!data.challenges || data.challenges.length === 0) ? <Empty title="No challenge disputes" /> : data.challenges.map((d: any) => (
        <Card key={d.id}>
          <Text style={styles.rowLabel}>{d.game} · ${d.stake}</Text>
          <Text style={styles.rowSub}>{d.creator_username} vs {d.opponent_username}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}><Button small title={`${d.creator_username} wins`} onPress={() => resolveCh(d.id, d.creator_id)} /></View>
            <View style={{ flex: 1 }}><Button small variant="secondary" title={`${d.opponent_username} wins`} onPress={() => resolveCh(d.id, d.opponent_id)} /></View>
          </View>
        </Card>
      ))}
      <Text style={[styles.subheader, { marginTop: spacing.lg }]}>TOURNAMENT MATCHES</Text>
      {(!data.tournament_matches || data.tournament_matches.length === 0) ? <Empty title="No tournament disputes" /> : data.tournament_matches.map((d: any) => (
        <Card key={d.match.id}>
          <Text style={styles.rowLabel}>{d.tournament.name}</Text>
          <Text style={styles.rowSub}>R{d.match.round + 1} · {d.match.p1?.username} vs {d.match.p2?.username}</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}><Button small title={`${d.match.p1?.username} wins`} onPress={() => resolveTm(d.tournament.id, d.match.id, d.match.p1.user_id)} /></View>
            <View style={{ flex: 1 }}><Button small variant="secondary" title={`${d.match.p2?.username} wins`} onPress={() => resolveTm(d.tournament.id, d.match.id, d.match.p2.user_id)} /></View>
          </View>
        </Card>
      ))}
    </>
  );
}

// ------------------- Tickets -------------------
function TicketsTab({ tickets, onOpen }: any) {
  return tickets.length === 0 ? <Empty title="No support tickets" /> : tickets.map((t: any) => (
    <TouchableOpacity key={t.id} onPress={() => onOpen(t)}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{t.subject}</Text>
            <Text style={styles.rowSub}>{t.username} · {new Date(t.created_at).toLocaleString()}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>{t.message}</Text>
          </View>
          <Pill label={t.status} tone={t.status === "open" ? "warning" : t.status === "closed" ? "default" : "success"} />
        </View>
      </Card>
    </TouchableOpacity>
  ));
}

function TicketModal({ ticket, onClose }: any) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState<any>(ticket);
  const refresh = async () => { const fresh = await api<any>(`/admin/tickets/${ticket.id}`); setT(fresh); };
  const send = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try { await api(`/admin/tickets/${ticket.id}/reply`, { method: "POST", body: JSON.stringify({ text: reply }) }); setReply(""); await refresh(); }
    finally { setBusy(false); }
  };
  const close = async () => { await api(`/admin/tickets/${ticket.id}/close`, { method: "POST" }); onClose(); };
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.modalRoot}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="ticket-modal-close" onPress={onClose}><Ionicons name="close" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>TICKET</Text>
          <TouchableOpacity onPress={close}><Text style={{ color: colors.error, fontWeight: "800", fontSize: 12 }}>CLOSE</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 200 + insets.bottom }} bottomOffset={120}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.rowLabel}>{t.subject}</Text>
            <Pill label={t.status} tone={t.status === "open" ? "warning" : t.status === "closed" ? "default" : "success"} />
          </View>
          <Text style={styles.rowSub}>{t.username} · {t.email || ""}</Text>
        </Card>
        {(t.messages || []).map((m: any, i: number) => (
          <View key={i} style={[styles.msg, m.from === "admin" ? styles.msgAdmin : styles.msgUser]}>
            <Text style={styles.msgAuthor}>{m.from === "admin" ? (m.author || "Admin") : t.username}</Text>
            <Text style={styles.msgText}>{m.text}</Text>
            <Text style={styles.msgTime}>{new Date(m.at).toLocaleString()}</Text>
          </View>
        ))}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
            <TextInput testID="ticket-reply-input" style={[styles_shared.input, { flex: 1, minHeight: 44, maxHeight: 120 }]} value={reply} onChangeText={setReply} placeholder="Write a reply..." placeholderTextColor={colors.onSurfaceTertiary} multiline />
            <View style={{ minWidth: 80 }}>
              <Button testID="ticket-send-btn" small title="Send" onPress={send} loading={busy} />
            </View>
          </View>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

// ------------------- Reports -------------------
function ReportsTab({ reports, onChange }: any) {
  const resolve = async (id: string, action: string) => { await api(`/admin/reports/${id}/resolve`, { method: "POST", body: JSON.stringify({ action }) }); onChange(); };
  return reports.length === 0 ? <Empty title="No reports" /> : reports.map((r: any) => (
    <Card key={r.id}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowLabel}>{r.target_type?.toUpperCase()} report</Text>
          <Text style={styles.rowSub}>By {r.reporter_username || r.reporter_id}</Text>
          <Text style={styles.rowSub}>Reason: {r.reason}</Text>
        </View>
        <Pill label={r.status} tone={r.status === "open" ? "warning" : "success"} />
      </View>
      {r.status === "open" && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
          <View style={{ flex: 1 }}><Button small title="Resolve" onPress={() => resolve(r.id, "resolved")} /></View>
          <View style={{ flex: 1 }}><Button small variant="secondary" title="Dismiss" onPress={() => resolve(r.id, "dismissed")} /></View>
          {r.target_type === "player" && r.target_id && (
            <View style={{ flex: 1 }}><Button small variant="danger" title="Suspend" onPress={() => resolve(r.id, "suspended")} /></View>
          )}
        </View>
      )}
    </Card>
  ));
}

// ------------------- Revenue -------------------
function RevenueTab({ items }: { items: any[] }) {
  const total = items.reduce((s, r) => s + (r.amount || 0), 0);
  return (
    <>
      <Card>
        <Text style={styles.kpiLabel}>TOTAL RECORDED</Text>
        <Text style={[styles.kpiValue, { color: colors.brand, fontSize: 36 }]}>${total.toFixed(2)}</Text>
        <Text style={styles.kpiSub}>{items.length} revenue events</Text>
      </Card>
      {items.length === 0 ? <Empty title="No revenue events yet" /> : items.map(r => (
        <Card key={r.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{r.type?.replace(/_/g, " ").toUpperCase()}</Text>
              <Text style={styles.rowSub}>{new Date(r.created_at).toLocaleString()}</Text>
              {r.tier ? <Text style={styles.rowSub}>Pool ${(r.pool || 0).toFixed(2)} · {(r.rate * 100).toFixed(0)}% · {r.tier}</Text> : null}
            </View>
            <Text style={styles.rowVal}>${r.amount?.toFixed(2)}</Text>
          </View>
        </Card>
      ))}
    </>
  );
}

// ------------------- Ads -------------------
function AdsTab({ items, onChange }: any) {
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!title || !image) return;
    setBusy(true);
    try { await api("/admin/ads", { method: "POST", body: JSON.stringify({ title, image, link, placement: "home", active: true }) }); setTitle(""); setImage(""); setLink(""); onChange(); }
    finally { setBusy(false); }
  };
  const toggle = async (id: string) => { await api(`/admin/ads/${id}/toggle`, { method: "POST" }); onChange(); };
  const remove = async (id: string) => { await api(`/admin/ads/${id}`, { method: "DELETE" }); onChange(); };
  return (
    <>
      <Card>
        <Text style={styles.section}>NEW AD (HOME BANNER)</Text>
        <View style={{ gap: spacing.sm }}>
          <TextInput style={styles_shared.input} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.onSurfaceTertiary} />
          <TextInput style={styles_shared.input} value={image} onChangeText={setImage} placeholder="Image URL" placeholderTextColor={colors.onSurfaceTertiary} autoCapitalize="none" />
          <TextInput style={styles_shared.input} value={link} onChangeText={setLink} placeholder="Link (optional)" placeholderTextColor={colors.onSurfaceTertiary} autoCapitalize="none" />
          <Button small title="Create Ad" onPress={create} loading={busy} disabled={!title || !image} />
        </View>
      </Card>
      {items.length === 0 ? <Empty title="No ads yet" /> : items.map(a => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{a.title}</Text>
              <Text style={styles.rowSub}>Placement: {a.placement}</Text>
            </View>
            <Pill label={a.active ? "active" : "inactive"} tone={a.active ? "success" : "default"} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <View style={{ flex: 1 }}><Button small title={a.active ? "Deactivate" : "Activate"} variant="secondary" onPress={() => toggle(a.id)} /></View>
            <View style={{ flex: 1 }}><Button small title="Delete" variant="danger" onPress={() => remove(a.id)} /></View>
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  subtitle: { color: colors.brand, fontSize: 9, letterSpacing: 1.5, fontWeight: "700" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, height: 48, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, flexShrink: 0 },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  chipLabel: { color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 11 },
  chipLabelActive: { color: colors.brand },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  kpi: { width: "31.5%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  kpiLabel: { color: colors.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.8, fontWeight: "800" },
  kpiValue: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 4 },
  kpiSub: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 2 },
  section: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "800", marginBottom: 4 },
  subheader: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "800", marginTop: spacing.sm },
  dim: { color: colors.onSurfaceTertiary, fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  rowSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  rowVal: { color: colors.brand, fontSize: 15, fontWeight: "900" },
  modalRoot: { position: "absolute", inset: 0, backgroundColor: colors.surface },
  msg: { padding: spacing.md, borderRadius: radius.md, maxWidth: "88%" },
  msgUser: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  msgAdmin: { alignSelf: "flex-end", backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.brand },
  msgAuthor: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  msgText: { color: colors.onSurface, fontSize: 14, marginTop: 4, lineHeight: 20 },
  msgTime: { color: colors.onSurfaceTertiary, fontSize: 10, marginTop: 4 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
});

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Pill, Button, Empty } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"analytics" | "users" | "disputes" | "revenue">("analytics");
  const [analytics, setAnalytics] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any>({ challenges: [], tournament_matches: [] });
  const [revenue, setRevenue] = useState<any[]>([]);

  useEffect(() => {
    if (tab === "analytics") api<any>("/admin/analytics").then(setAnalytics);
    if (tab === "users") api<any[]>("/admin/users").then(setUsers);
    if (tab === "disputes") api<any>("/admin/disputes").then(setDisputes);
    if (tab === "revenue") api<any[]>("/admin/revenue").then(setRevenue);
  }, [tab]);

  if (!user?.is_admin) {
    return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.error }}>Admin access required</Text></View>;
  }

  const toggle = async (uid: string, suspended: boolean) => {
    await api(`/admin/users/${uid}/${suspended ? "unsuspend" : "suspend"}`, { method: "POST" });
    setUsers(await api("/admin/users"));
  };
  const resolve = async (ch_id: string, winner_id: string) => {
    await api(`/admin/disputes/${ch_id}/resolve`, { method: "POST", body: JSON.stringify({ winner_id }) });
    setDisputes(await api("/admin/disputes"));
  };
  const resolveTournament = async (t_id: string, match_id: string, winner_id: string) => {
    await api(`/admin/tournaments/${t_id}/matches/${match_id}/resolve`, { method: "POST", body: JSON.stringify({ winner_id }) });
    setDisputes(await api("/admin/disputes"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>ADMIN</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, height: 56, alignItems: "center" }}>
          {["analytics", "users", "disputes", "revenue"].map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t as any)} style={[styles.chip, tab === t && styles.chipActive]}>
              <Text style={[styles.chipLabel, tab === t && styles.chipLabelActive]}>{t.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        {tab === "analytics" && (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
              <Stat label="USERS" value={analytics.users || 0} />
              <Stat label="CHALLENGES" value={analytics.challenges || 0} />
              <Stat label="TOURNAMENTS" value={analytics.tournaments || 0} />
              <Stat label="FINALIZED" value={analytics.finalized_challenges || 0} />
              <Stat label="DEPOSITS" value={`$${(analytics.total_deposits || 0).toFixed(0)}`} tone="brand" />
              <Stat label="WITHDRAWALS" value={`$${(analytics.total_withdrawals || 0).toFixed(0)}`} tone="brand" />
            </View>
            <Card>
              <Text style={styles.h}>REVENUE BY TYPE</Text>
              {(analytics.revenue_by_type || []).map((r: any) => (
                <View key={r._id} style={styles.rev}>
                  <Text style={styles.revLabel}>{r._id?.replace(/_/g, " ")}</Text>
                  <Text style={styles.revVal}>${r.total.toFixed(2)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
        {tab === "users" && (
          users.map(u => (
            <Card key={u.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.uName}>{u.username} {u.is_admin ? <Text style={{ color: colors.brand }}>· ADMIN</Text> : null}</Text>
                  <Text style={styles.uEmail}>{u.email}</Text>
                  <Text style={styles.uMeta}>${u.wallet_balance?.toFixed(2)} · {u.stats?.matches || 0} matches</Text>
                </View>
                {u.suspended ? <Pill label="suspended" tone="danger" /> : <Pill label="active" tone="success" />}
                <TouchableOpacity onPress={() => toggle(u.id, u.suspended)} style={{ marginLeft: 8 }}>
                  <Text style={{ color: u.suspended ? colors.success : colors.error, fontWeight: "700" }}>{u.suspended ? "UNSUSPEND" : "SUSPEND"}</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        {tab === "disputes" && (
          <>
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginTop: 4 }}>H2H CHALLENGES</Text>
            {disputes.challenges?.length === 0 ? <Empty title="No challenge disputes" /> : disputes.challenges?.map((d: any) => (
              <Card key={d.id}>
                <Text style={styles.h}>{d.game} · ${d.stake}</Text>
                <Text style={styles.uMeta}>{d.creator_username} vs {d.opponent_username}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}><Button small title={`${d.creator_username} wins`} onPress={() => resolve(d.id, d.creator_id)} /></View>
                  <View style={{ flex: 1 }}><Button small variant="secondary" title={`${d.opponent_username} wins`} onPress={() => resolve(d.id, d.opponent_id)} /></View>
                </View>
              </Card>
            ))}
            <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginTop: spacing.lg }}>TOURNAMENT MATCHES</Text>
            {(!disputes.tournament_matches || disputes.tournament_matches.length === 0) ? <Empty title="No tournament disputes" /> : disputes.tournament_matches.map((d: any) => (
              <Card key={d.match.id}>
                <Text style={styles.h}>{d.tournament.name}</Text>
                <Text style={styles.uMeta}>Round {d.match.round + 1} · {d.match.p1?.username} vs {d.match.p2?.username}</Text>
                <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                  <View style={{ flex: 1 }}><Button small title={`${d.match.p1?.username} wins`} onPress={() => resolveTournament(d.tournament.id, d.match.id, d.match.p1.user_id)} /></View>
                  <View style={{ flex: 1 }}><Button small variant="secondary" title={`${d.match.p2?.username} wins`} onPress={() => resolveTournament(d.tournament.id, d.match.id, d.match.p2.user_id)} /></View>
                </View>
              </Card>
            ))}
          </>
        )}
        {tab === "revenue" && (
          revenue.map(r => (
            <Card key={r.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Text style={styles.uName}>{r.type.replace(/_/g, " ").toUpperCase()}</Text>
                  <Text style={styles.uMeta}>{new Date(r.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.revVal}>${r.amount.toFixed(2)}</Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
function Stat({ label, value, tone }: any) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, tone === "brand" && { color: colors.brand }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  chip: { paddingHorizontal: spacing.lg, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  chipLabel: { color: colors.onSurfaceSecondary, fontWeight: "700", fontSize: 12 },
  chipLabelActive: { color: colors.brand },
  stat: { width: "48%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statVal: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 4 },
  h: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  rev: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  revLabel: { color: colors.onSurfaceSecondary, fontSize: 13 },
  revVal: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  uName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  uEmail: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  uMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
});

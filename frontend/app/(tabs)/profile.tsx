import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ImageBackground } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Card, Empty, Pill, Button, Divider } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Profile() {
  const { user, signOut, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const m = await api<any[]>(`/profile/${user.id}/matches`);
      setMatches(m);
    } catch (e) { console.log(e); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); await load(); setRefreshing(false); };

  if (!user) return null;

  const stats = user.stats || { wins: 0, losses: 0, earnings: 0, rank: 1500, matches: 0 };
  const winRate = stats.matches ? Math.round((stats.wins / stats.matches) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Cover + Avatar */}
        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1567027757540-7b572280fa22?crop=entropy&cs=srgb&fm=jpg&w=900" }}
          style={styles.cover}
        >
          <LinearGradient colors={["rgba(17,18,16,0.3)", "rgba(17,18,16,0.95)"]} style={styles.coverOverlay}>
            <SafeAreaView edges={["top"]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", padding: spacing.lg }}>
                <TouchableOpacity testID="profile-settings-btn" onPress={() => router.push("/settings")}>
                  <View style={styles.iconBtn}><Ionicons name="settings-outline" size={20} color={colors.onSurface} /></View>
                </TouchableOpacity>
                <TouchableOpacity testID="profile-edit-btn" onPress={() => router.push("/edit-profile")}>
                  <View style={styles.iconBtn}><Ionicons name="create-outline" size={20} color={colors.onSurface} /></View>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </ImageBackground>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: -50 }}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{user.username?.[0]?.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          <View style={{ flexDirection: "row", gap: 6, marginTop: spacing.md }}>
            {(user.badges || []).map((b, i) => <Pill key={i} label={b.replace(/_/g, " ")} tone="brand" />)}
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatBox testID="stat-rank" label="RANK" value={stats.rank} tone="brand" />
            <StatBox testID="stat-winrate" label="WIN RATE" value={`${winRate}%`} />
            <StatBox testID="stat-wins" label="WINS" value={stats.wins} />
            <StatBox testID="stat-losses" label="LOSSES" value={stats.losses} />
            <StatBox testID="stat-earnings" label="EARNINGS" value={`$${stats.earnings.toFixed(0)}`} tone="brand" />
            <StatBox testID="stat-matches" label="MATCHES" value={stats.matches} />
          </View>

          {/* Sections */}
          <Section title="MATCH HISTORY">
            {matches.length === 0 ? <Empty title="No matches yet" subtitle="Play your first challenge!" /> : (
              matches.slice(0, 5).map(m => {
                const isWin = m.winner_id === user.id;
                return (
                  <TouchableOpacity key={m.id} onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: m.id } })}>
                    <View style={styles.matchRow}>
                      <View style={[styles.matchIndicator, { backgroundColor: isWin ? colors.success : colors.error }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matchGame}>{m.game}</Text>
                        <Text style={styles.matchSub}>vs {m.creator_id === user.id ? m.opponent_username : m.creator_username}</Text>
                      </View>
                      <Text style={[styles.matchResult, { color: isWin ? colors.success : colors.error }]}>{isWin ? "WIN" : "LOSS"}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </Section>

          <Section title="ACCOUNT">
            <MenuRow icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications")} testID="menu-notifications" />
            <MenuRow icon="shield-checkmark-outline" label="Devices & Sessions" onPress={() => router.push("/devices")} testID="menu-devices" />
            <MenuRow icon="chatbubbles-outline" label="Support" onPress={() => router.push("/support")} testID="menu-support" />
            <MenuRow icon="book-outline" label="Rules & FAQ" onPress={() => router.push("/rules")} testID="menu-rules" />
            {user.is_admin ? <MenuRow icon="briefcase-outline" label="Admin Dashboard" onPress={() => router.push("/admin")} testID="menu-admin" /> : null}
            <MenuRow icon="log-out-outline" label="Sign Out" onPress={signOut} destructive testID="menu-signout" />
          </Section>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function StatBox({ label, value, tone, testID }: any) {
  return (
    <View testID={testID} style={styles.statBox}>
      <Text style={[styles.statValue, tone === "brand" && { color: colors.brand }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress, destructive, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.menuRow}>
      <Ionicons name={icon} size={20} color={destructive ? colors.error : colors.onSurfaceSecondary} />
      <Text style={[styles.menuLabel, destructive && { color: colors.error }]}>{label}</Text>
      {!destructive && <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cover: { height: 200 },
  coverOverlay: { flex: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  avatarWrap: { alignItems: "flex-start" },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.brand, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: colors.brand, fontSize: 44, fontWeight: "900" },
  username: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: spacing.md },
  email: { color: colors.onSurfaceTertiary, fontSize: 13 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: spacing.sm },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.xl },
  statBox: { width: "31%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  statValue: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 4 },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.md },
  sectionCard: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  matchRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  matchIndicator: { width: 4, height: 32, borderRadius: 2 },
  matchGame: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  matchSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  matchResult: { fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuLabel: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "600" },
});

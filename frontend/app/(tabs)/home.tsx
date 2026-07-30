import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, Empty, SectionHeader, Pill } from "@/src/components/ui";
import { Logo } from "@/src/components/logo";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Home() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ads, setAds] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, t, c, notifs] = await Promise.all([
        api<any[]>("/ads?placement=home"),
        api<any[]>("/tournaments"),
        api<any[]>("/challenges?status=open"),
        api<any[]>("/notifications"),
      ]);
      setAds(a); setTournaments(t.slice(0, 5)); setChallenges(c.slice(0, 5));
      setUnread(notifs.filter(n => !n.read).length);
    } catch (e) { console.log("home load err", e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); await load(); setRefreshing(false); };

  const featured = tournaments.find(t => t.tournament_type === "sponsored") || tournaments[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Logo size={44} />
            <View>
              <Text style={styles.hi}>WELCOME BACK</Text>
              <Text style={styles.name}>{user?.username}</Text>
            </View>
          </View>
          <TouchableOpacity testID="home-notifications-btn" onPress={() => router.push("/notifications")}>
            <View style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={22} color={colors.onSurface} />
              {unread > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero / featured tournament */}
        {featured ? (
          <TouchableOpacity testID="home-featured-tournament" activeOpacity={0.9} onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: featured.id } })}>
            <ImageBackground
              source={{ uri: featured.banner || "https://images.pexels.com/photos/7915213/pexels-photo-7915213.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
              style={styles.hero}
              imageStyle={{ borderRadius: radius.lg }}
            >
              <LinearGradient colors={["rgba(17,18,16,0.2)", "rgba(17,18,16,0.95)"]} style={styles.heroOverlay}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <Pill label={featured.tournament_type} tone="brand" />
                  {featured.sponsor ? <Pill label={featured.sponsor} tone="default" /> : null}
                </View>
                <Text style={styles.heroTitle}>{featured.name}</Text>
                <Text style={styles.heroMeta}>{featured.game} · {featured.platform} · ${featured.prize_pool} prize pool</Text>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>
        ) : null}

        {/* Quick actions grid */}
        <SectionHeader title="QUICK ACTIONS" />
        <View style={styles.grid}>
          <QuickAction testID="qa-deposit" icon="wallet" label="Deposit" onPress={() => router.push("/wallet/deposit")} />
          <QuickAction testID="qa-create-challenge" icon="flash" label="Create H2H" onPress={() => router.push("/(tabs)/play")} />
          <QuickAction testID="qa-tournaments" icon="trophy" label="Tournaments" onPress={() => router.push("/(tabs)/tournaments")} />
          <QuickAction testID="qa-leaderboard" icon="podium" label="Leaderboard" onPress={() => router.push("/leaderboard")} />
        </View>

        {/* Open challenges */}
        <SectionHeader title="LIVE CHALLENGES" action={
          <TouchableOpacity onPress={() => router.push("/(tabs)/play")}><Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>SEE ALL</Text></TouchableOpacity>
        } />
        {challenges.length === 0 ? (
          <Card><Empty title="No open challenges" subtitle="Be the first to create one!" /></Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {challenges.map(c => (
              <TouchableOpacity key={c.id} onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: c.id } })}>
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chGame}>{c.game}</Text>
                      <Text style={styles.chSub}>{c.creator_username} · {c.platform} · {c.region}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.chStake}>${c.stake}</Text>
                      <Pill label={c.status} tone="brand" />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Upcoming tournaments */}
        <SectionHeader title="UPCOMING EVENTS" action={
          <TouchableOpacity onPress={() => router.push("/(tabs)/tournaments")}><Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>SEE ALL</Text></TouchableOpacity>
        } />
        <View style={{ gap: spacing.md }}>
          {tournaments.map(t => (
            <TouchableOpacity key={t.id} onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: t.id } })}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chGame}>{t.name}</Text>
                    <Text style={styles.chSub}>{t.game} · {t.registered?.length || 0}/{t.max_players} players</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.chStake}>${t.prize_pool}</Text>
                    <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>PRIZE POOL</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} activeOpacity={0.85} style={styles.qa}>
      <View style={styles.qaIcon}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <Text style={styles.qaLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  hi: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  name: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: colors.surface },
  badgeText: { color: colors.onSurface, fontSize: 10, fontWeight: "800" },
  hero: { height: 200, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  heroOverlay: { padding: spacing.lg, borderRadius: radius.lg, gap: 6 },
  heroTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900", letterSpacing: 0.3 },
  heroMeta: { color: colors.onSurfaceSecondary, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  qa: { width: "48%", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, gap: 8 },
  qaIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  qaLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  chGame: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  chSub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  chStake: { color: colors.brand, fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
});

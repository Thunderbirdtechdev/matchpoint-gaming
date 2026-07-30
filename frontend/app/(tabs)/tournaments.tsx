import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl, FlatList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, Chip, Empty, Pill, Header } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

const TYPES = [
  { key: "all", label: "All" },
  { key: "public", label: "Public" },
  { key: "invite", label: "Invite-only" },
  { key: "sponsored", label: "Sponsored" },
];

export default function Tournaments() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [type, setType] = useState("all");
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = type === "all" ? "" : `?tournament_type=${type}`;
      const data = await api<any[]>(`/tournaments${q}`);
      setItems(data);
    } catch (e) { console.log(e); }
  }, [type]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={{ paddingTop: spacing.md }}>
          <Header title="TOURNAMENTS" right={
            <TouchableOpacity testID="tournaments-create-btn" onPress={() => router.push("/tournament/create")}>
              <View style={styles.iconBtn}><Ionicons name="add" size={22} color={colors.brand} /></View>
            </TouchableOpacity>
          } />
          {/* Sticky chip row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, height: 56, alignItems: "center" }}>
            {TYPES.map(t => (
              <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} testID={`tourn-chip-${t.key}`} />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 + insets.bottom, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={<View style={{ paddingTop: 60 }}><Empty title="No tournaments" subtitle="Check back soon or create one." /></View>}
        renderItem={({ item: t }) => (
          <TouchableOpacity testID={`tournament-card-${t.id}`} onPress={() => router.push({ pathname: "/tournament/[id]", params: { id: t.id } })} activeOpacity={0.9}>
            <View style={styles.card}>
              <ImageBackground
                source={{ uri: t.banner || "https://images.pexels.com/photos/12187128/pexels-photo-12187128.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
                style={styles.cardImg}
                imageStyle={{ borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md }}
              >
                <LinearGradient colors={["rgba(17,18,16,0.1)", "rgba(17,18,16,0.9)"]} style={{ flex: 1, justifyContent: "flex-end", padding: spacing.lg }}>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pill label={t.tournament_type} tone={t.tournament_type === "sponsored" ? "brand" : "default"} />
                    {t.sponsor ? <Pill label={t.sponsor} /> : null}
                  </View>
                  <Text style={styles.name}>{t.name}</Text>
                </LinearGradient>
              </ImageBackground>
              <View style={styles.cardBody}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View>
                    <Text style={styles.stat}>{t.game}</Text>
                    <Text style={styles.statLabel}>GAME</Text>
                  </View>
                  <View>
                    <Text style={styles.stat}>{t.registered?.length || 0}/{t.max_players}</Text>
                    <Text style={styles.statLabel}>PLAYERS</Text>
                  </View>
                  <View>
                    <Text style={styles.stat}>${t.entry_fee}</Text>
                    <Text style={styles.statLabel}>ENTRY</Text>
                  </View>
                  <View>
                    <Text style={[styles.stat, { color: colors.brand }]}>${t.prize_pool}</Text>
                    <Text style={styles.statLabel}>PRIZE</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  cardImg: { height: 140 },
  name: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 8 },
  cardBody: { padding: spacing.lg, flexDirection: "row" },
  stat: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 2 },
});

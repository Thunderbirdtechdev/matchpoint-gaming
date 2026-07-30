import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, Chip, Empty, Pill, Header, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Play() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"open" | "mine" | "invites">("open");
  const [gameFilter, setGameFilter] = useState<string>("");
  const [games, setGames] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      let q = "";
      if (tab === "invites") q = "?invites=true";
      else if (tab === "mine") q = "?mine=true";
      else q = `?status=open${gameFilter ? `&game=${encodeURIComponent(gameFilter)}` : ""}`;
      const data = await api<any[]>(`/challenges${q}`);
      setItems(data);
    } catch (e) { console.log(e); }
  }, [tab, gameFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api<{ games: string[] }>("/meta/games").then(d => setGames(d.games)).catch(() => {});
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={{ paddingTop: spacing.md }}>
          <Header title="HEAD TO HEAD" right={
            <TouchableOpacity testID="play-create-btn" onPress={() => router.push("/challenge/create")}>
              <View style={styles.iconBtn}><Ionicons name="add" size={22} color={colors.brand} /></View>
            </TouchableOpacity>
          } />
          <View style={styles.tabs}>
            <TouchableOpacity testID="play-tab-open" onPress={() => setTab("open")} style={[styles.tab, tab === "open" && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === "open" && styles.tabLabelActive]}>OPEN</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="play-tab-invites" onPress={() => setTab("invites")} style={[styles.tab, tab === "invites" && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === "invites" && styles.tabLabelActive]}>INVITES{items.length > 0 && tab !== "invites" ? "" : ""}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="play-tab-mine" onPress={() => setTab("mine")} style={[styles.tab, tab === "mine" && styles.tabActive]}>
              <Text style={[styles.tabLabel, tab === "mine" && styles.tabLabelActive]}>MY MATCHES</Text>
            </TouchableOpacity>
          </View>
          {tab === "open" && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, height: 56, alignItems: "center" }}>
              <Chip label="All Games" active={!gameFilter} onPress={() => setGameFilter("")} />
              {games.map(g => (
                <Chip key={g} label={g} active={gameFilter === g} onPress={() => setGameFilter(g)} />
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 + insets.bottom, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListEmptyComponent={<View style={{ paddingTop: 60 }}><Empty title="No challenges" subtitle="Create the first one!" /></View>}
        renderItem={({ item: c }) => {
          const isMine = c.creator_id === user?.id;
          const isOpponent = c.opponent_id === user?.id;
          const statusTone = c.status === "open" ? "brand" : c.status === "finalized" ? "success" : c.status === "disputed" ? "danger" : c.status === "matched" ? "warning" : "default";
          return (
            <TouchableOpacity testID={`challenge-card-${c.id}`} onPress={() => router.push({ pathname: "/challenge/[id]", params: { id: c.id } })} activeOpacity={0.9}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
                  <Pill label={c.status} tone={statusTone as any} />
                  <Text style={styles.stake}>${c.stake}</Text>
                </View>
                <Text style={styles.game}>{c.game}</Text>
                <View style={{ flexDirection: "row", marginTop: 6, gap: spacing.md }}>
                  <MetaChip icon="game-controller" text={c.platform} />
                  <MetaChip icon="globe" text={c.region} />
                </View>
                <View style={styles.vs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.player}>{c.creator_username}{isMine ? " (YOU)" : ""}</Text>
                    <Text style={styles.playerRole}>CREATOR</Text>
                  </View>
                  <Text style={styles.vsText}>VS</Text>
                  <View style={{ flex: 1, alignItems: "flex-end" }}>
                    <Text style={styles.player}>{c.opponent_username || "OPEN"}{isOpponent ? " (YOU)" : ""}</Text>
                    <Text style={styles.playerRole}>OPPONENT</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function MetaChip({ icon, text }: any) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={colors.onSurfaceTertiary} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.lg, marginBottom: spacing.sm },
  tab: { paddingVertical: spacing.md, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: colors.brand },
  tabLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 },
  tabLabelActive: { color: colors.brand },
  game: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  stake: { color: colors.brand, fontSize: 22, fontWeight: "900" },
  vs: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg },
  player: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  playerRole: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, marginTop: 2 },
  vsText: { color: colors.brand, fontSize: 12, fontWeight: "800", marginHorizontal: spacing.md, letterSpacing: 1 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  metaText: { color: colors.onSurfaceSecondary, fontSize: 11 },
});

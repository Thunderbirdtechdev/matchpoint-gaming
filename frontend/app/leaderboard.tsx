import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Chip } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function Leaderboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<string[]>([]);
  const [game, setGame] = useState<string>("");
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api<any>("/meta/games").then(m => setGames(m.games)); }, []);
  useEffect(() => {
    const q = game ? `?game=${encodeURIComponent(game)}` : "";
    api<any[]>(`/leaderboards/global${q}`).then(setRows);
  }, [game]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>LEADERBOARD</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm, height: 56, alignItems: "center" }}>
          <Chip label="Global" active={!game} onPress={() => setGame("")} />
          {games.map(g => <Chip key={g} label={g} active={game === g} onPress={() => setGame(g)} />)}
        </ScrollView>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20, gap: spacing.sm }}>
        {rows.map((r, i) => (
          <View key={r.user_id} style={styles.row}>
            <Text style={[styles.rank, i < 3 && { color: colors.brand }]}>#{i + 1}</Text>
            <View style={styles.avatar}><Text style={{ color: colors.brand, fontWeight: "800" }}>{r.username?.[0]?.toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.username}</Text>
              <Text style={styles.sub}>{r.wins} wins · ${r.earnings.toFixed(0)} earned</Text>
            </View>
            <Text style={styles.score}>{r.rank}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  rank: { color: colors.onSurfaceSecondary, fontSize: 15, fontWeight: "900", width: 36 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  sub: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  score: { color: colors.brand, fontSize: 18, fontWeight: "900" },
});

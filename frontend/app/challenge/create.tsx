import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function CreateChallenge() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [game, setGame] = useState(""); const [platform, setPlatform] = useState("");
  const [region, setRegion] = useState("GLOBAL"); const [stake, setStake] = useState("10");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  useEffect(() => {
    api<any>("/meta/games").then((m) => {
      setGames(m.games); setPlatforms(m.platforms); setRegions(m.regions);
      setGame(m.games[0]); setPlatform(m.platforms[0]);
    });
  }, []);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const stakeNum = parseFloat(stake);
      if (!stakeNum || stakeNum <= 0) throw new Error("Enter a valid stake");
      const c = await api<any>("/challenges", { method: "POST", body: JSON.stringify({ game, platform, region, stake: stakeNum, notes }) });
      await refresh();
      router.replace({ pathname: "/challenge/[id]", params: { id: c.id } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="create-challenge-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>CREATE H2H</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>

      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 + insets.bottom, gap: spacing.lg }} bottomOffset={120}>
        <View>
          <Text style={styles_shared.label}>GAME</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
            {games.map(g => <Chip key={g} label={g} active={game === g} onPress={() => setGame(g)} />)}
          </ScrollView>
        </View>
        <View>
          <Text style={styles_shared.label}>PLATFORM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
            {platforms.map(p => <Chip key={p} label={p} active={platform === p} onPress={() => setPlatform(p)} />)}
          </ScrollView>
        </View>
        <View>
          <Text style={styles_shared.label}>REGION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
            {regions.map(r => <Chip key={r} label={r} active={region === r} onPress={() => setRegion(r)} />)}
          </ScrollView>
        </View>
        <View>
          <Text style={styles_shared.label}>STAKE (USD)</Text>
          <TextInput testID="create-challenge-stake" style={styles_shared.input} value={stake} onChangeText={setStake} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={colors.onSurfaceTertiary} />
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>Available: ${user?.wallet_balance?.toFixed(2)}. Winner gets both stakes minus 10% platform fee.</Text>
        </View>
        <View>
          <Text style={styles_shared.label}>NOTES (OPTIONAL)</Text>
          <TextInput testID="create-challenge-notes" style={[styles_shared.input, { minHeight: 80, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} multiline placeholder="e.g. Best of 3, no glitches" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="create-challenge-submit" title={`Create Challenge · $${stake}`} onPress={submit} loading={busy} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
});

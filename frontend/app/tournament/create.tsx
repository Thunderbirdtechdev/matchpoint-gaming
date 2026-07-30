import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Chip, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function CreateTournament() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [types] = useState([
    { key: "public", label: "Public" },
    { key: "private", label: "Private" },
    { key: "invite", label: "Invite" },
    { key: "sponsored", label: "Sponsored" },
  ]);
  const [name, setName] = useState("");
  const [game, setGame] = useState(""); const [platform, setPlatform] = useState("");
  const [type, setType] = useState<any>("public");
  const [fee, setFee] = useState("10"); const [max, setMax] = useState("16");
  const [prize, setPrize] = useState("100"); const [sponsor, setSponsor] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  useEffect(() => { api<any>("/meta/games").then(m => { setGames(m.games); setPlatforms(m.platforms); setGame(m.games[0]); setPlatform(m.platforms[0]); }); }, []);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (!name) throw new Error("Name required");
      const t = await api<any>("/tournaments", { method: "POST", body: JSON.stringify({
        name, game, platform, entry_fee: parseFloat(fee) || 0, max_players: parseInt(max) || 16,
        prize_pool: parseFloat(prize) || 0, tournament_type: type,
        sponsor: type === "sponsored" ? sponsor : null, description: desc,
      }) });
      router.replace({ pathname: "/tournament/[id]", params: { id: t.id } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="create-tournament-back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>NEW TOURNAMENT</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 + insets.bottom, gap: spacing.lg }} bottomOffset={120}>
        <View>
          <Text style={styles_shared.label}>NAME</Text>
          <TextInput testID="tournament-name-input" style={styles_shared.input} value={name} onChangeText={setName} placeholder="Nightfall Championship" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        <View>
          <Text style={styles_shared.label}>TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: 4 }}>
            {types.map(t => <Chip key={t.key} label={t.label} active={type === t.key} onPress={() => setType(t.key)} />)}
          </ScrollView>
        </View>
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
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>ENTRY ($)</Text>
            <TextInput testID="tournament-fee-input" style={styles_shared.input} value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>MAX PLAYERS</Text>
            <TextInput testID="tournament-max-input" style={styles_shared.input} value={max} onChangeText={setMax} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
        </View>
        <View>
          <Text style={styles_shared.label}>STARTING PRIZE POOL ($)</Text>
          <TextInput testID="tournament-prize-input" style={styles_shared.input} value={prize} onChangeText={setPrize} keyboardType="decimal-pad" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        {type === "sponsored" && (
          <View>
            <Text style={styles_shared.label}>SPONSOR NAME</Text>
            <TextInput testID="tournament-sponsor-input" style={styles_shared.input} value={sponsor} onChangeText={setSponsor} placeholder="e.g. Red Bull Gaming" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
        )}
        <View>
          <Text style={styles_shared.label}>DESCRIPTION</Text>
          <TextInput testID="tournament-desc-input" style={[styles_shared.input, { minHeight: 80, textAlignVertical: "top" }]} value={desc} onChangeText={setDesc} multiline placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="create-tournament-submit" title="Create Tournament" onPress={submit} loading={busy} />
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

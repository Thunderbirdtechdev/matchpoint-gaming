import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { Card, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

/**
 * Dedicated H2H match reporting screen with score fields + evidence upload.
 * Route: /report/challenge/[id]
 */
export default function ReportChallenge() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [ch, setCh] = useState<any>(null);
  const [winnerChoice, setWinnerChoice] = useState<"me" | "opp" | null>(null);
  const [myScore, setMyScore] = useState("");
  const [oppScore, setOppScore] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { api(`/challenges/${id}`).then(setCh).catch(console.log); }, [id]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr("Permission needed to upload evidence"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, quality: 0.6, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setEvidence(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const submit = async () => {
    if (!winnerChoice) { setErr("Select the winner"); return; }
    setErr(""); setBusy(true);
    try {
      const isCreator = ch.creator_id === user?.id;
      const meId = user?.id;
      const oppId = isCreator ? ch.opponent_id : ch.creator_id;
      const winnerId = winnerChoice === "me" ? meId : oppId;
      await api(`/challenges/${id}/report`, {
        method: "POST",
        body: JSON.stringify({
          winner_id: winnerId,
          my_score: myScore ? parseInt(myScore) : null,
          opponent_score: oppScore ? parseInt(oppScore) : null,
          evidence,
        }),
      });
      await refresh();
      router.replace({ pathname: "/challenge/[id]", params: { id } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (!ch) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ color: colors.onSurface, padding: 20 }}>Loading...</Text></SafeAreaView>;

  const isCreator = ch.creator_id === user?.id;
  const meName = isCreator ? ch.creator_username : ch.opponent_username;
  const oppName = isCreator ? ch.opponent_username : ch.creator_username;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity testID="report-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>REPORT RESULT</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 160 + insets.bottom }} bottomOffset={120}>
        <Card>
          <Text style={styles.sub}>MATCH</Text>
          <Text style={styles.game}>{ch.game}</Text>
          <Text style={styles.meta}>{ch.platform} · Stake ${ch.stake}</Text>
        </Card>

        <Text style={styles_shared.label}>WHO WON?</Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TouchableOpacity testID="report-winner-me" onPress={() => setWinnerChoice("me")} style={[styles.winnerCard, winnerChoice === "me" && styles.winnerCardActive]}>
            <Ionicons name="trophy" size={28} color={winnerChoice === "me" ? colors.brand : colors.onSurfaceTertiary} />
            <Text style={[styles.winnerLabel, winnerChoice === "me" && { color: colors.brand }]}>I WON</Text>
            <Text style={styles.winnerName}>{meName}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="report-winner-opp" onPress={() => setWinnerChoice("opp")} style={[styles.winnerCard, winnerChoice === "opp" && styles.winnerCardActive]}>
            <Ionicons name="close-circle-outline" size={28} color={winnerChoice === "opp" ? colors.brand : colors.onSurfaceTertiary} />
            <Text style={[styles.winnerLabel, winnerChoice === "opp" && { color: colors.brand }]}>OPPONENT WON</Text>
            <Text style={styles.winnerName}>{oppName || "TBD"}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>MY SCORE</Text>
            <TextInput testID="report-my-score" style={styles_shared.input} value={myScore} onChangeText={setMyScore} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>OPPONENT SCORE</Text>
            <TextInput testID="report-opp-score" style={styles_shared.input} value={oppScore} onChangeText={setOppScore} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
        </View>

        <View>
          <Text style={styles_shared.label}>EVIDENCE (SCREENSHOT)</Text>
          {evidence ? (
            <View>
              <Image source={{ uri: evidence }} style={styles.evidenceImg} />
              <TouchableOpacity testID="report-remove-evidence" onPress={() => setEvidence(null)} style={styles.removeBtn}>
                <Text style={{ color: colors.error, fontWeight: "700" }}>REMOVE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity testID="report-pick-evidence" onPress={pickImage} style={styles.uploadBtn}>
              <Ionicons name="camera" size={22} color={colors.brand} />
              <Text style={{ color: colors.brand, fontWeight: "700", marginTop: 6 }}>Upload Screenshot</Text>
              <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4, textAlign: "center" }}>Recommended if you expect a dispute</Text>
            </TouchableOpacity>
          )}
        </View>

        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <Text style={styles.tip}>Both players must report the same winner for automatic payout. Mismatched reports trigger admin review.</Text>
          </View>
        </Card>

        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="report-submit-btn" title="Submit Result" onPress={submit} loading={busy} disabled={!winnerChoice} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  sub: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  game: { color: colors.onSurface, fontSize: 22, fontWeight: "900", marginTop: 4 },
  meta: { color: colors.onSurfaceSecondary, fontSize: 13 },
  winnerCard: { flex: 1, alignItems: "center", padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, gap: 6 },
  winnerCardActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  winnerLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "800" },
  winnerName: { color: colors.onSurface, fontSize: 13, fontWeight: "700" },
  uploadBtn: { alignItems: "center", padding: spacing.xl, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", backgroundColor: colors.surfaceSecondary },
  evidenceImg: { width: "100%", height: 200, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  removeBtn: { alignSelf: "flex-end", padding: 8, marginTop: 4 },
  tip: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
});

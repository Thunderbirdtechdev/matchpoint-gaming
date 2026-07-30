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
 * Tournament-match reporting screen.
 * Route: /report/tournament/[id]?match=[match_id]
 */
export default function ReportTournamentMatch() {
  const { id, match: matchId } = useLocalSearchParams<{ id: string; match: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<any>(null);
  const [match, setMatch] = useState<any>(null);
  const [winnerChoice, setWinnerChoice] = useState<"me" | "opp" | null>(null);
  const [myScore, setMyScore] = useState("");
  const [oppScore, setOppScore] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<any>(`/tournaments/${id}`).then(tt => {
      setT(tt);
      for (const round of tt.brackets || []) {
        for (const m of round) if (m.id === matchId) { setMatch(m); return; }
      }
    }).catch(console.log);
  }, [id, matchId]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr("Permission needed to upload evidence"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]?.base64) setEvidence(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  if (!t || !match) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ color: colors.onSurface, padding: 20 }}>Loading...</Text></SafeAreaView>;

  const isP1 = match.p1?.user_id === user?.id;
  const isP2 = match.p2?.user_id === user?.id;
  const me = isP1 ? match.p1 : match.p2;
  const opp = isP1 ? match.p2 : match.p1;

  if (!isP1 && !isP2) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <Text style={{ color: colors.error, fontSize: 16 }}>You are not a participant in this match.</Text>
        <View style={{ marginTop: spacing.lg, width: "100%" }}>
          <Button title="Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const submit = async () => {
    if (!winnerChoice) { setErr("Select the winner"); return; }
    setErr(""); setBusy(true);
    try {
      const winnerId = winnerChoice === "me" ? me?.user_id : opp?.user_id;
      await api(`/tournaments/${id}/report`, {
        method: "POST",
        body: JSON.stringify({
          match_id: matchId, winner_id: winnerId,
          my_score: myScore ? parseInt(myScore) : null,
          opponent_score: oppScore ? parseInt(oppScore) : null,
          evidence,
        }),
      });
      await refresh();
      router.replace({ pathname: "/tournament/[id]", params: { id } });
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity testID="tmreport-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>REPORT MATCH</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 160 + insets.bottom }} bottomOffset={120}>
        <Card>
          <Text style={styles.sub}>{t.name.toUpperCase()}</Text>
          <Text style={styles.round}>ROUND {match.round + 1} · MATCH {match.index + 1}</Text>
        </Card>

        <Text style={styles_shared.label}>WHO WON?</Text>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TouchableOpacity testID="tmreport-winner-me" onPress={() => setWinnerChoice("me")} style={[styles.winnerCard, winnerChoice === "me" && styles.winnerCardActive]}>
            <Ionicons name="trophy" size={28} color={winnerChoice === "me" ? colors.brand : colors.onSurfaceTertiary} />
            <Text style={[styles.winnerLabel, winnerChoice === "me" && { color: colors.brand }]}>I WON</Text>
            <Text style={styles.winnerName}>{me?.username}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tmreport-winner-opp" onPress={() => setWinnerChoice("opp")} style={[styles.winnerCard, winnerChoice === "opp" && styles.winnerCardActive]}>
            <Ionicons name="close-circle-outline" size={28} color={winnerChoice === "opp" ? colors.brand : colors.onSurfaceTertiary} />
            <Text style={[styles.winnerLabel, winnerChoice === "opp" && { color: colors.brand }]}>OPPONENT WON</Text>
            <Text style={styles.winnerName}>{opp?.username || "TBD"}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>MY SCORE</Text>
            <TextInput testID="tmreport-my-score" style={styles_shared.input} value={myScore} onChangeText={setMyScore} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceTertiary} placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles_shared.label}>OPPONENT SCORE</Text>
            <TextInput testID="tmreport-opp-score" style={styles_shared.input} value={oppScore} onChangeText={setOppScore} keyboardType="number-pad" placeholderTextColor={colors.onSurfaceTertiary} placeholder="0" />
          </View>
        </View>

        <View>
          <Text style={styles_shared.label}>EVIDENCE (SCREENSHOT)</Text>
          {evidence ? (
            <View>
              <Image source={{ uri: evidence }} style={styles.evidenceImg} />
              <TouchableOpacity onPress={() => setEvidence(null)} style={styles.removeBtn}>
                <Text style={{ color: colors.error, fontWeight: "700" }}>REMOVE</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity testID="tmreport-pick-evidence" onPress={pickImage} style={styles.uploadBtn}>
              <Ionicons name="camera" size={22} color={colors.brand} />
              <Text style={{ color: colors.brand, fontWeight: "700", marginTop: 6 }}>Upload Screenshot</Text>
            </TouchableOpacity>
          )}
        </View>

        <Card>
          <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
            <Ionicons name="information-circle" size={18} color={colors.warning} />
            <Text style={styles.tip}>Winners advance to the next bracket round. If reports don&apos;t match, the match is disputed and reviewed by an admin.</Text>
          </View>
        </Card>

        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="tmreport-submit-btn" title="Submit Result" onPress={submit} loading={busy} disabled={!winnerChoice} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  sub: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  round: { color: colors.brand, fontSize: 22, fontWeight: "900", marginTop: 4 },
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

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Empty, Pill, Button, Divider } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function ChallengeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [ch, setCh] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try { setCh(await api(`/challenges/${id}`)); } catch (e) { console.log(e); }
  };
  useEffect(() => { load(); }, [id]);

  if (!ch) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ color: colors.onSurface, padding: 20 }}>Loading...</Text></SafeAreaView>;

  const isCreator = ch.creator_id === user?.id;
  const isOpponent = ch.opponent_id === user?.id;
  const canAccept = ch.status === "open" && !isCreator;
  const canCancel = ch.status === "open" && isCreator;
  const canReport = ch.status === "matched" && (isCreator || isOpponent) && !(ch.results?.[user?.id || ""]);
  const showResults = ch.status === "reported" || ch.status === "finalized" || ch.status === "disputed";

  const call = async (fn: () => Promise<any>) => {
    setBusy(true); setErr("");
    try { await fn(); await refresh(); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="challenge-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>CHALLENGE</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 + insets.bottom, gap: spacing.md }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pill label={ch.status} tone={ch.status === "open" ? "brand" : ch.status === "finalized" ? "success" : ch.status === "disputed" ? "danger" : "warning"} />
            <Text style={styles.stake}>${ch.stake}</Text>
          </View>
          <Text style={styles.game}>{ch.game}</Text>
          <Text style={styles.meta}>{ch.platform} · {ch.region}</Text>
          <Divider />
          <View style={styles.vs}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerRole}>CREATOR</Text>
              <Text style={styles.player}>{ch.creator_username}</Text>
            </View>
            <Text style={styles.vsText}>VS</Text>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.playerRole}>OPPONENT</Text>
              <Text style={styles.player}>{ch.opponent_username || "OPEN"}</Text>
            </View>
          </View>
          {ch.notes ? <><Divider /><Text style={styles.notes}>{ch.notes}</Text></> : null}
        </Card>

        {showResults && (
          <Card>
            <Text style={styles.section}>RESULTS</Text>
            {ch.winner_id ? (
              <>
                <Text style={styles.winnerLabel}>WINNER</Text>
                <Text style={styles.winner}>{ch.winner_id === ch.creator_id ? ch.creator_username : ch.opponent_username}</Text>
                {ch.payout ? <Text style={styles.payout}>Payout: ${ch.payout.toFixed(2)} (fee: ${ch.platform_fee?.toFixed(2)})</Text> : null}
              </>
            ) : (
              <Text style={{ color: colors.warning }}>Awaiting both participants to report the same winner.</Text>
            )}
          </Card>
        )}

        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </ScrollView>

      {/* Sticky action bar */}
      <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
        {canAccept && <Button testID="challenge-accept-btn" title={`Accept · $${ch.stake}`} onPress={() => call(() => api(`/challenges/${id}/accept`, { method: "POST" }))} loading={busy} />}
        {canCancel && <Button testID="challenge-cancel-btn" title="Cancel Challenge" variant="danger" onPress={() => call(() => api(`/challenges/${id}/cancel`, { method: "POST" }))} loading={busy} />}
        {canReport && (
          <View style={{ gap: spacing.sm }}>
            <Button testID="challenge-open-report" title="Report Match Result" onPress={() => router.push({ pathname: "/report/challenge/[id]", params: { id } })} />
          </View>
        )}
        {!canAccept && !canCancel && !canReport && ch.status === "reported" && (
          <Text style={{ color: colors.onSurfaceTertiary, textAlign: "center" }}>Waiting for the other player to report...</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  stake: { color: colors.brand, fontSize: 32, fontWeight: "900" },
  game: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: spacing.md },
  meta: { color: colors.onSurfaceTertiary, fontSize: 13, marginTop: 4 },
  vs: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  player: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  playerRole: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  vsText: { color: colors.brand, fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  notes: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  section: { color: colors.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  winnerLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  winner: { color: colors.brand, fontSize: 22, fontWeight: "900", marginTop: 4 },
  payout: { color: colors.success, fontSize: 14, marginTop: 6, fontWeight: "700" },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  reportLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700", textAlign: "center" },
});

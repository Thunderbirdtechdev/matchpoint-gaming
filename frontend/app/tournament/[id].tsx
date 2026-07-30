import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Card, Pill, Button, Divider, Empty } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function TournamentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [t, setT] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => { try { setT(await api(`/tournaments/${id}`)); } catch (e) { console.log(e); } };
  useEffect(() => { load(); }, [id]);

  if (!t) return null;

  const registered = (t.registered || []).some((p: any) => p.user_id === user?.id);
  const canRegister = t.status === "open" && !registered && (t.registered?.length || 0) < t.max_players;
  const canStart = t.status === "open" && (t.registered?.length || 0) >= 2 && (t.created_by === user?.id || user?.is_admin);

  const register = async () => {
    setBusy(true); setErr("");
    try { await api(`/tournaments/${id}/register`, { method: "POST" }); await refresh(); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true); setErr("");
    try { await api(`/tournaments/${id}/start`, { method: "POST" }); await load(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}>
        <ImageBackground
          source={{ uri: t.banner || "https://images.pexels.com/photos/12187128/pexels-photo-12187128.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
          style={styles.hero}
        >
          <LinearGradient colors={["rgba(17,18,16,0.4)", "rgba(17,18,16,0.95)"]} style={styles.heroOverlay}>
            <SafeAreaView edges={["top"]}>
              <TouchableOpacity testID="tournament-back-btn" onPress={() => router.back()} style={{ padding: spacing.lg }}>
                <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
              </TouchableOpacity>
            </SafeAreaView>
            <View style={{ padding: spacing.xl, gap: 6 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pill label={t.tournament_type} tone="brand" />
                {t.sponsor ? <Pill label={t.sponsor} /> : null}
              </View>
              <Text style={styles.name}>{t.name}</Text>
              <Text style={styles.meta}>{t.game} · {t.platform}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={styles.big}>${t.prize_pool}</Text>
                <Text style={styles.smallLabel}>PRIZE POOL</Text>
              </View>
              <View>
                <Text style={styles.big}>${t.entry_fee}</Text>
                <Text style={styles.smallLabel}>ENTRY FEE</Text>
              </View>
              <View>
                <Text style={styles.big}>{t.registered?.length || 0}/{t.max_players}</Text>
                <Text style={styles.smallLabel}>PLAYERS</Text>
              </View>
            </View>
          </Card>

          {t.description ? (
            <Card>
              <Text style={styles.section}>ABOUT</Text>
              <Text style={styles.desc}>{t.description}</Text>
            </Card>
          ) : null}

          <Card>
            <Text style={styles.section}>REGISTERED PLAYERS</Text>
            {(t.registered || []).length === 0 ? <Empty title="No players registered yet" /> : (
              (t.registered || []).map((p: any) => (
                <View key={p.user_id} style={styles.playerRow}>
                  <View style={styles.playerAvatar}><Text style={{ color: colors.brand, fontWeight: "800" }}>{p.username?.[0]?.toUpperCase()}</Text></View>
                  <Text style={styles.playerName}>{p.username}</Text>
                  {p.user_id === user?.id && <Pill label="you" tone="brand" />}
                </View>
              ))
            )}
          </Card>

          {t.brackets && t.brackets.length > 0 && (
            <Card>
              <Text style={styles.section}>BRACKETS</Text>
              {t.brackets.map((round: any[], i: number) => (
                <View key={i} style={{ marginTop: spacing.md }}>
                  <Text style={styles.roundLabel}>ROUND {i + 1}</Text>
                  {round.map((m) => (
                    <View key={m.id} style={styles.matchRow}>
                      <Text style={styles.matchP}>{m.p1?.username || "TBD"}</Text>
                      <Text style={styles.matchVs}>vs</Text>
                      <Text style={styles.matchP}>{m.p2?.username || "BYE"}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </Card>
          )}

          {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
        </View>
      </ScrollView>

      <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
        {registered && !canStart ? (
          <View style={styles.registeredPill}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.success, fontWeight: "700" }}>You&apos;re registered</Text>
          </View>
        ) : null}
        {canRegister && <Button testID="tournament-register-btn" title={t.entry_fee > 0 ? `Register · $${t.entry_fee}` : "Register (Free)"} onPress={register} loading={busy} />}
        {canStart && <Button testID="tournament-start-btn" title="Start Tournament" onPress={start} loading={busy} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 280 },
  heroOverlay: { flex: 1, justifyContent: "space-between" },
  name: { color: colors.onSurface, fontSize: 28, fontWeight: "900" },
  meta: { color: colors.onSurfaceSecondary, fontSize: 14 },
  big: { color: colors.brand, fontSize: 24, fontWeight: "900" },
  smallLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700", marginTop: 2 },
  section: { color: colors.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  desc: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 8 },
  playerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  playerName: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  roundLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: 6 },
  matchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, padding: spacing.md, marginBottom: 6 },
  matchP: { color: colors.onSurface, fontWeight: "700", flex: 1 },
  matchVs: { color: colors.brand, fontWeight: "800", marginHorizontal: 8 },
  stickyBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  registeredPill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.pill, backgroundColor: "rgba(16,185,129,0.15)" },
});

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

type Prefs = {
  email_invites: boolean;
  email_matches: boolean;
  email_prize: boolean;
  email_wallet: boolean;
  email_disputes: boolean;
};

const DEFAULTS: Prefs = {
  email_invites: true,
  email_matches: true,
  email_prize: true,
  email_wallet: true,
  email_disputes: true,
};

const ROWS: { key: keyof Prefs; icon: keyof typeof Ionicons.glyphMap; label: string; desc: string }[] = [
  { key: "email_invites", icon: "mail-open-outline", label: "1v1 Invites", desc: "When another player challenges or declines you." },
  { key: "email_matches", icon: "flash-outline", label: "Match Updates", desc: "When your challenge is accepted or advances." },
  { key: "email_prize", icon: "trophy-outline", label: "Prize Payouts", desc: "When you win a match or tournament prize." },
  { key: "email_wallet", icon: "wallet-outline", label: "Wallet Activity", desc: "Deposit and withdrawal confirmations." },
  { key: "email_disputes", icon: "shield-checkmark-outline", label: "Fair-Play Reviews", desc: "When a match is under fair-play review." },
];

export default function NotificationPreferences() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await api<Prefs>("/notifications/preferences");
        setPrefs({ ...DEFAULTS, ...p });
      } catch (e: any) {
        Alert.alert("Couldn't load preferences", e?.message ?? "Try again later.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (key: keyof Prefs) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    try {
      const updated = await api<Prefs>("/notifications/preferences", {
        method: "PATCH",
        body: JSON.stringify({ [key]: next }),
      });
      setPrefs({ ...DEFAULTS, ...updated });
    } catch (e: any) {
      // rollback
      setPrefs((p) => ({ ...p, [key]: !next }));
      Alert.alert("Couldn't save", e?.message ?? "Try again later.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.title}>NOTIFICATIONS</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        <Text style={styles.intro}>
          In-app alerts are always on. Choose which of these also send you an email.
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <Card>
            {ROWS.map((r, idx) => (
              <View key={r.key} style={[styles.row, idx < ROWS.length - 1 && styles.rowDivider]}>
                <View style={styles.iconWrap}>
                  <Ionicons name={r.icon} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowDesc}>{r.desc}</Text>
                </View>
                {saving === r.key ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    testID={`toggle-${r.key}`}
                    value={prefs[r.key]}
                    onValueChange={() => toggle(r.key)}
                    trackColor={{ true: colors.primary, false: "#2C3129" }}
                    thumbColor={prefs[r.key] ? "#111210" : "#5B6252"}
                  />
                )}
              </View>
            ))}
          </Card>
        )}
        <Text style={styles.hint}>
          You&apos;ll always receive critical account emails (security, verification, and dispute rulings)
          regardless of these settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  intro: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginBottom: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#2C3129" },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#1E2118" },
  rowLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  rowDesc: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2, lineHeight: 16 },
  hint: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", marginTop: spacing.md, lineHeight: 16 },
});

import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function Rules() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rules, setRules] = useState<any[]>([]);
  const [fees, setFees] = useState<any>(null);
  useEffect(() => {
    api<any>("/rules").then(r => setRules(r.sections));
    api<any>("/meta/fees").then(setFees);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>RULES & FEES</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        {rules.map((s, i) => (
          <Card key={i}>
            <Text style={styles.h}>{s.title}</Text>
            <Text style={styles.b}>{s.content}</Text>
          </Card>
        ))}

        {fees && (
          <>
            <Card>
              <Text style={styles.h}>Platform Service Fee</Text>
              <Text style={styles.b}>Charged on the total prize pool. Lower rates on bigger pools:</Text>
              {fees.platform_tiers.map((t: any, i: number) => (
                <View key={i} style={styles.tierRow}>
                  <Text style={styles.tierLabel}>{t.label}</Text>
                  <Text style={styles.tierRate}>{(t.rate * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </Card>
            <Card>
              <Text style={styles.h}>Withdrawal Fees</Text>
              <Text style={styles.b}>Standard withdrawals (2–5 business days) are always FREE. Same-day withdrawals use the tiered fees below:</Text>
              {fees.withdrawal_tiers_same_day.map((t: any, i: number) => (
                <View key={i} style={styles.tierRow}>
                  <Text style={styles.tierLabel}>{t.label}</Text>
                  <Text style={styles.tierRate}>
                    {t.flat_fee_cents !== null ? `$${(t.flat_fee_cents / 100).toFixed(2)}` : `${(t.pct_rate * 100).toFixed(0)}%`}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  h: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  b: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
  tierRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  tierLabel: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  tierRate: { color: colors.brand, fontSize: 14, fontWeight: "800" },
});

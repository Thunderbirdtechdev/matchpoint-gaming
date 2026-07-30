import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Empty } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function WalletHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [txs, setTxs] = useState<any[]>([]);
  useEffect(() => { api<any[]>("/wallet/transactions").then(setTxs); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>ALL TRANSACTIONS</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20, gap: spacing.sm }}>
        {txs.length === 0 ? <Empty title="No transactions" /> : txs.map(tx => (
          <Card key={tx.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.type}>{tx.type.replace(/_/g, " ").toUpperCase()}</Text>
                <Text style={styles.date}>{new Date(tx.created_at).toLocaleString()} · {tx.status}</Text>
              </View>
              <Text style={[styles.amt, { color: tx.type === "withdrawal" || tx.type === "tournament_entry" ? colors.error : colors.success }]}>
                {tx.type === "withdrawal" || tx.type === "tournament_entry" ? "-" : "+"}${Math.abs(tx.amount).toFixed(2)}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  type: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  date: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
  amt: { fontSize: 16, fontWeight: "800" },
});

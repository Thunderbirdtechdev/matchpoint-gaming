import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ImageBackground } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, Empty, Pill, Header, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Wallet() {
  const router = useRouter();
  const { refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [wallet, setWallet] = useState<any>({ balance: 0, pending: 0, available: 0, earnings: 0 });
  const [txs, setTxs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([api<any>("/wallet"), api<any[]>("/wallet/transactions")]);
      setWallet(w); setTxs(t);
    } catch (e) { console.log(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await refresh(); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <Header title="WALLET" testID="wallet-header" right={
          <TouchableOpacity testID="wallet-history-btn" onPress={() => router.push("/wallet/history")}>
            <View style={styles.iconBtn}><Ionicons name="time-outline" size={20} color={colors.onSurface} /></View>
          </TouchableOpacity>
        } />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        {/* Balance hero */}
        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1689443111130-6e9c7dfd8f9e?crop=entropy&cs=srgb&fm=jpg&w=900" }}
          style={styles.hero}
          imageStyle={{ borderRadius: radius.lg }}
        >
          <LinearGradient colors={["rgba(41,51,0,0.75)", "rgba(17,18,16,0.95)"]} style={styles.heroInner}>
            <Text style={styles.balLabel}>AVAILABLE BALANCE</Text>
            <Text testID="wallet-balance" style={styles.balAmount}>${wallet.available?.toFixed(2)}</Text>
            <View style={{ flexDirection: "row", marginTop: spacing.md, gap: spacing.xl }}>
              <View>
                <Text style={styles.miniLabel}>PENDING</Text>
                <Text style={styles.miniAmount}>${wallet.pending?.toFixed(2)}</Text>
              </View>
              <View>
                <Text style={styles.miniLabel}>EARNINGS</Text>
                <Text style={styles.miniAmount}>${wallet.earnings?.toFixed(2)}</Text>
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Button testID="wallet-deposit-btn" title="+ Deposit" onPress={() => router.push("/wallet/deposit")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button testID="wallet-withdraw-btn" title="Withdraw" variant="secondary" onPress={() => router.push("/wallet/withdraw")} />
          </View>
        </View>

        {/* Transactions */}
        <Text style={styles.section}>RECENT TRANSACTIONS</Text>
        {txs.length === 0 ? (
          <Card><Empty title="No transactions yet" subtitle="Make your first deposit to get started." /></Card>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {txs.map(tx => (
              <Card key={tx.id}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                    <View style={styles.txIcon}>
                      <Ionicons name={txIcon(tx.type)} size={18} color={colors.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txType}>{txLabel(tx.type)}</Text>
                      <Text style={styles.txTime}>{new Date(tx.created_at).toLocaleDateString()} · {tx.status}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.type === "withdrawal" || tx.type === "tournament_entry" ? colors.error : colors.success }]}>
                    {tx.type === "withdrawal" || tx.type === "tournament_entry" ? "-" : "+"}${Math.abs(tx.amount || 0).toFixed(2)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function txIcon(t: string) {
  if (t === "deposit") return "arrow-down-circle";
  if (t === "withdrawal") return "arrow-up-circle";
  if (t === "prize_winning") return "trophy";
  if (t === "tournament_entry") return "ticket";
  return "cash";
}
function txLabel(t: string) {
  const m: any = { deposit: "Deposit", withdrawal: "Withdrawal", prize_winning: "Prize Winning", tournament_entry: "Tournament Entry" };
  return m[t] || t;
}

const styles = StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  hero: { height: 180, borderRadius: radius.lg, overflow: "hidden" },
  heroInner: { flex: 1, padding: spacing.xl, borderRadius: radius.lg, justifyContent: "center" },
  balLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1.5, fontWeight: "700" },
  balAmount: { color: colors.brand, fontSize: 48, fontWeight: "900", letterSpacing: -1, marginTop: 6 },
  miniLabel: { color: colors.onSurfaceTertiary, fontSize: 10, letterSpacing: 1, fontWeight: "700" },
  miniAmount: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: 2 },
  section: { color: colors.onSurfaceTertiary, fontSize: 12, letterSpacing: 1, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  txIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  txType: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  txTime: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: "800" },
});

import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Withdraw() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("****1234");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const val = parseFloat(amount) || 0;
  const fee = Math.round(val * 2) / 100;
  const net = Math.max(0, val - fee);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await api<any>("/wallet/withdraw", { method: "POST", body: JSON.stringify({ amount: val, bank_account: bank }) });
      await refresh();
      setSuccess(res);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={styles.checkCircle}><Ionicons name="checkmark" size={48} color={colors.onBrandPrimary} /></View>
        <Text style={styles.successTitle}>Withdrawal Initiated</Text>
        <Text style={styles.successSub}>${success.net.toFixed(2)} will arrive in your bank soon (fee: ${success.fee.toFixed(2)}).</Text>
        <View style={{ marginTop: spacing.xxl, width: "100%" }}>
          <Button testID="withdraw-done-btn" title="Back to Wallet" onPress={() => router.replace("/(tabs)/wallet")} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="withdraw-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>WITHDRAW</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} bottomOffset={120}>
        <Card>
          <Text style={styles.avail}>Available: <Text style={{ color: colors.brand, fontWeight: "800" }}>${user?.wallet_balance?.toFixed(2)}</Text></Text>
        </Card>
        <View>
          <Text style={styles_shared.label}>AMOUNT ($)</Text>
          <TextInput testID="withdraw-amount-input" style={styles_shared.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        <View>
          <Text style={styles_shared.label}>BANK ACCOUNT</Text>
          <TextInput testID="withdraw-bank-input" style={styles_shared.input} value={bank} onChangeText={setBank} placeholder="****1234" placeholderTextColor={colors.onSurfaceTertiary} />
          <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 }}>Verified account required for withdrawals over $500.</Text>
        </View>
        <Card>
          <View style={styles.feeRow}><Text style={styles.feeLabel}>Amount</Text><Text style={styles.feeVal}>${val.toFixed(2)}</Text></View>
          <View style={styles.feeRow}><Text style={styles.feeLabel}>Fee (2%)</Text><Text style={styles.feeVal}>-${fee.toFixed(2)}</Text></View>
          <View style={[styles.feeRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <Text style={[styles.feeLabel, { fontWeight: "800", color: colors.onSurface }]}>You Receive</Text>
            <Text style={[styles.feeVal, { color: colors.brand, fontWeight: "900", fontSize: 18 }]}>${net.toFixed(2)}</Text>
          </View>
        </Card>
        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="withdraw-submit-btn" title={`Withdraw · $${val.toFixed(2)}`} onPress={submit} loading={busy} disabled={val < 10} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  avail: { color: colors.onSurfaceSecondary, fontSize: 14 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  feeLabel: { color: colors.onSurfaceTertiary, fontSize: 13 },
  feeVal: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  successTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: spacing.xl },
  successSub: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
});

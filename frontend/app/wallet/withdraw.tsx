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
import { calculateWithdrawalFee, WithdrawalSpeed } from "@/src/fees";

export default function Withdraw() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("****1234");
  const [speed, setSpeed] = useState<WithdrawalSpeed>("standard");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState<any>(null);

  const val = parseFloat(amount) || 0;
  const cents = Math.round(val * 100);
  const bd = calculateWithdrawalFee(cents, speed);
  const feeUsd = bd.feeCents / 100;
  const netUsd = bd.netCents / 100;

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      const res = await api<any>("/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: val, speed, bank_account: bank }),
      });
      await refresh();
      setSuccess(res);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  if (success) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={styles.checkCircle}><Ionicons name="checkmark" size={48} color={colors.onBrandPrimary} /></View>
        <Text style={styles.successTitle}>Withdrawal Initiated</Text>
        <Text style={styles.successSub}>${success.net.toFixed(2)} will arrive in your bank ({success.eta}). Fee: ${success.fee.toFixed(2)}</Text>
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
          <Text style={styles_shared.label}>PAYOUT SPEED</Text>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <TouchableOpacity testID="speed-standard" onPress={() => setSpeed("standard")} style={[styles.speedCard, speed === "standard" && styles.speedCardActive]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.speedTitle, speed === "standard" && { color: colors.brand }]}>Standard</Text>
                <View style={styles.freePill}><Text style={styles.freePillTxt}>FREE</Text></View>
              </View>
              <Text style={styles.speedSub}>2–5 business days</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="speed-sameday" onPress={() => setSpeed("same_day")} style={[styles.speedCard, speed === "same_day" && styles.speedCardActive]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={[styles.speedTitle, speed === "same_day" && { color: colors.brand }]}>Same-day</Text>
                <Ionicons name="flash" size={16} color={colors.brand} />
              </View>
              <Text style={styles.speedSub}>~30 min – 5 hours</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text style={styles_shared.label}>BANK ACCOUNT</Text>
          <TextInput testID="withdraw-bank-input" style={styles_shared.input} value={bank} onChangeText={setBank} placeholder="****1234" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>

        <Card>
          <View style={styles.feeRow}><Text style={styles.feeLabel}>Amount</Text><Text style={styles.feeVal}>${val.toFixed(2)}</Text></View>
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>Fee ({bd.tierLabel})</Text>
            <Text style={styles.feeVal}>{feeUsd === 0 ? "Free" : `-$${feeUsd.toFixed(2)}`}</Text>
          </View>
          <View style={styles.feeRow}><Text style={styles.feeLabel}>ETA</Text><Text style={styles.feeVal}>{bd.etaLabel}</Text></View>
          <View style={[styles.feeRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.divider }]}>
            <Text style={[styles.feeLabel, { fontWeight: "800", color: colors.onSurface }]}>You Receive</Text>
            <Text style={[styles.feeVal, { color: colors.brand, fontWeight: "900", fontSize: 18 }]}>${netUsd.toFixed(2)}</Text>
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
  speedCard: { flex: 1, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, gap: 4 },
  speedCardActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  speedTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  speedSub: { color: colors.onSurfaceTertiary, fontSize: 11 },
  freePill: { backgroundColor: colors.brand, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
  freePillTxt: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  feeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  feeLabel: { color: colors.onSurfaceTertiary, fontSize: 13 },
  feeVal: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  successTitle: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: spacing.xl },
  successSub: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
});

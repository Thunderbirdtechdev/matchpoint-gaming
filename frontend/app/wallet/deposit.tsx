import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Linking } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

const QUICK = [10, 25, 50, 100, 250, 500];

export default function Deposit() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("50");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const start = async () => {
    setErr(""); setBusy(true);
    try {
      const val = parseFloat(amount);
      if (!val || val < 5) throw new Error("Minimum $5");
      const res = await api<any>("/wallet/deposit", { method: "POST", body: JSON.stringify({ amount: val }) });
      setSessionId(res.session_id);
      if (res.url) Linking.openURL(res.url);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!sessionId) return;
    setBusy(true); setErr("");
    try {
      const s = await api<any>(`/wallet/deposit/status/${sessionId}`);
      if (s.payment_status === "paid") {
        router.replace("/wallet/success");
      } else {
        setErr("Payment not yet completed. Complete checkout, then tap 'I've paid'.");
      }
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.top}>
          <TouchableOpacity testID="deposit-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>DEPOSIT</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} bottomOffset={120}>
        <Card>
          <Text style={styles.label}>AMOUNT</Text>
          <View style={styles.amountRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput testID="deposit-amount-input" style={styles.amountInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.onSurfaceTertiary} />
          </View>
        </Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {QUICK.map(q => (
            <TouchableOpacity key={q} testID={`deposit-quick-${q}`} onPress={() => setAmount(String(q))} style={[styles.qBtn, amount === String(q) && styles.qBtnActive]}>
              <Text style={[styles.qLabel, amount === String(q) && styles.qLabelActive]}>${q}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card>
          <Text style={styles.infoTitle}>Powered by Stripe</Text>
          <Text style={styles.info}>You&apos;ll be redirected to Stripe&apos;s secure checkout to complete the payment. Use test card 4242 4242 4242 4242 with any future date and any CVC.</Text>
        </Card>
        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
        {sessionId ? (
          <Card>
            <Text style={styles.infoTitle}>Session Started</Text>
            <Text style={styles.info}>Complete payment on the Stripe page, then tap the button below.</Text>
            <View style={{ marginTop: spacing.md }}>
              <Button testID="deposit-verify-btn" title="I've completed payment" variant="secondary" onPress={verify} loading={busy} />
            </View>
          </Card>
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="deposit-submit-btn" title={`Continue · $${amount}`} onPress={start} loading={busy} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  label: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700" },
  amountRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  dollar: { color: colors.brand, fontSize: 44, fontWeight: "900" },
  amountInput: { flex: 1, color: colors.onSurface, fontSize: 44, fontWeight: "900", padding: 0 },
  qBtn: { paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  qBtnActive: { backgroundColor: colors.brandTertiary, borderColor: colors.brand },
  qLabel: { color: colors.onSurfaceSecondary, fontWeight: "700" },
  qLabelActive: { color: colors.brand },
  infoTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  info: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
});

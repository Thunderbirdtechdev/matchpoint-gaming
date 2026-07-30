import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string; dev_code?: string }>();
  const [code, setCode] = useState(String(params.dev_code || ""));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      await api("/auth/verify-email", { method: "POST", auth: false, body: JSON.stringify({ email: params.email, code }) });
      router.replace("/(auth)/login");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={20}>
        <Text style={styles.title}>Verify email</Text>
        <Text style={styles.sub}>Enter the 6-digit code sent to {params.email}.</Text>
        {params.dev_code ? <Text style={styles.devHint}>DEV CODE: {params.dev_code}</Text> : null}

        <View style={{ marginTop: spacing.xxl }}>
          <Text style={styles_shared.label}>VERIFICATION CODE</Text>
          <TextInput testID="verify-email-code-input" style={[styles_shared.input, { letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: "700" }]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={colors.onSurfaceTertiary} keyboardType="number-pad" maxLength={6} />
          {err ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
        </View>
        <View style={{ marginTop: spacing.xxl }}>
          <Button testID="verify-email-submit-btn" title="Verify" onPress={submit} loading={loading} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { color: colors.onSurface, fontSize: 32, fontWeight: "800" },
  sub: { color: colors.onSurfaceTertiary, fontSize: 15, marginTop: 6 },
  devHint: { color: colors.brand, fontSize: 12, marginTop: 8, fontWeight: "600" },
});

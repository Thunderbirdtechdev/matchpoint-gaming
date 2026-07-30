import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Verify2FA() {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email: string; dev_code?: string }>();
  const [code, setCode] = useState(String(params.dev_code || ""));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await api<any>("/auth/verify-2fa", { method: "POST", auth: false, body: JSON.stringify({ email: params.email, code }) });
      await signIn(res.access_token, res.user);
      router.replace(res.user?.is_admin ? "/admin" : "/(tabs)/home");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={20}>
        <Text style={styles.title}>2-Step Verification</Text>
        <Text style={styles.sub}>Enter the 6-digit login code sent to {params.email}.</Text>
        {params.dev_code ? <Text style={styles.devHint}>DEV CODE: {params.dev_code}</Text> : null}

        <View style={{ marginTop: spacing.xxl }}>
          <Text style={styles_shared.label}>LOGIN CODE</Text>
          <TextInput testID="verify-2fa-code-input" style={[styles_shared.input, { letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: "700" }]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={colors.onSurfaceTertiary} keyboardType="number-pad" maxLength={6} />
          {err ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
        </View>
        <View style={{ marginTop: spacing.xxl }}>
          <Button testID="verify-2fa-submit-btn" title="Verify & Sign In" onPress={submit} loading={loading} />
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

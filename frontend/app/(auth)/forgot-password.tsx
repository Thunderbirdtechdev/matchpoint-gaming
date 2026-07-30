import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [devCode, setDevCode] = useState("");

  const requestCode = async () => {
    setErr(""); setLoading(true);
    try {
      const res = await api<any>("/auth/forgot-password", { method: "POST", auth: false, body: JSON.stringify({ email }) });
      if (res.dev_code) { setDevCode(res.dev_code); setCode(res.dev_code); }
      setStep("reset");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  const submitReset = async () => {
    setErr(""); setLoading(true);
    try {
      await api("/auth/reset-password", { method: "POST", auth: false, body: JSON.stringify({ email, code, new_password: newPassword }) });
      router.replace("/(auth)/login");
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={20}>
        <Text style={styles.title}>Forgot password</Text>
        {step === "email" ? (
          <>
            <Text style={styles.sub}>We&apos;ll send a reset code to your email.</Text>
            <View style={{ marginTop: spacing.xxl }}>
              <Text style={styles_shared.label}>EMAIL</Text>
              <TextInput testID="forgot-email-input" style={styles_shared.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.onSurfaceTertiary} autoCapitalize="none" keyboardType="email-address" />
              {err ? <Text style={{ color: colors.error, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
            </View>
            <View style={{ marginTop: spacing.xxl }}>
              <Button testID="forgot-request-btn" title="Send Reset Code" onPress={requestCode} loading={loading} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sub}>Enter the code from your email and choose a new password.</Text>
            {devCode ? <Text style={styles.devHint}>DEV CODE: {devCode}</Text> : null}
            <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
              <View>
                <Text style={styles_shared.label}>CODE</Text>
                <TextInput testID="forgot-code-input" style={styles_shared.input} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor={colors.onSurfaceTertiary} keyboardType="number-pad" />
              </View>
              <View>
                <Text style={styles_shared.label}>NEW PASSWORD</Text>
                <TextInput testID="forgot-new-password-input" style={styles_shared.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={colors.onSurfaceTertiary} />
              </View>
              {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
            </View>
            <View style={{ marginTop: spacing.xxl }}>
              <Button testID="forgot-reset-btn" title="Reset Password" onPress={submitReset} loading={loading} />
            </View>
          </>
        )}
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

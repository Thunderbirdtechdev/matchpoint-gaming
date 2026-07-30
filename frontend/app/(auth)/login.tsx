import { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("demo@matchpoint.gg");
  const [password, setPassword] = useState("Demo@123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await api<any>("/auth/login", {
        method: "POST", auth: false, body: JSON.stringify({ email, password }),
      });
      if (res.require_verification) {
        router.push({ pathname: "/(auth)/verify-email", params: { email, dev_code: res.dev_code } });
      } else if (res.require_2fa) {
        router.push({ pathname: "/(auth)/verify-2fa", params: { email, dev_code: res.dev_code } });
      }
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={20}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.sub}>Welcome back to the arena.</Text>

        <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
          <View>
            <Text style={styles_shared.label}>EMAIL</Text>
            <TextInput
              testID="login-email-input"
              style={styles_shared.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.onSurfaceTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View>
            <Text style={styles_shared.label}>PASSWORD</Text>
            <TextInput
              testID="login-password-input"
              style={styles_shared.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.onSurfaceTertiary}
              secureTextEntry
            />
          </View>
          <TouchableOpacity testID="forgot-password-link" onPress={() => router.push("/(auth)/forgot-password")}>
            <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "600" }}>Forgot password?</Text>
          </TouchableOpacity>
          {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
        </View>
        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <Button testID="login-submit-btn" title="Sign In" onPress={submit} loading={loading} />
          <Button testID="login-goto-register-btn" title="Create an account" variant="ghost" onPress={() => router.replace("/(auth)/register")} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { color: colors.onSurface, fontSize: 32, fontWeight: "800", letterSpacing: -0.5 },
  sub: { color: colors.onSurfaceTertiary, fontSize: 15, marginTop: 6 },
});

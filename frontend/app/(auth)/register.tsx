import { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!username || !email || password.length < 6) { setErr("Please fill in all fields (password 6+ chars)"); return; }
    setLoading(true);
    try {
      const res = await api<any>("/auth/register", { method: "POST", auth: false, body: JSON.stringify({ email, password, username }) });
      router.push({ pathname: "/(auth)/verify-email", params: { email, dev_code: res.dev_code } });
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAwareScrollView contentContainerStyle={styles.wrap} bottomOffset={20}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.sub}>Join thousands of competitive gamers.</Text>

        <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
          <View>
            <Text style={styles_shared.label}>USERNAME</Text>
            <TextInput testID="register-username-input" style={styles_shared.input} value={username} onChangeText={setUsername} placeholder="ProGamer" placeholderTextColor={colors.onSurfaceTertiary} autoCapitalize="none" />
          </View>
          <View>
            <Text style={styles_shared.label}>EMAIL</Text>
            <TextInput testID="register-email-input" style={styles_shared.input} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.onSurfaceTertiary} autoCapitalize="none" keyboardType="email-address" />
          </View>
          <View>
            <Text style={styles_shared.label}>PASSWORD</Text>
            <TextInput testID="register-password-input" style={styles_shared.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" placeholderTextColor={colors.onSurfaceTertiary} secureTextEntry />
          </View>
          {err ? <Text style={{ color: colors.error, fontSize: 13 }}>{err}</Text> : null}
        </View>
        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <Button testID="register-submit-btn" title="Create Account" onPress={submit} loading={loading} />
          <Button testID="register-goto-login-btn" title="I have an account" variant="ghost" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingTop: spacing.xxl },
  title: { color: colors.onSurface, fontSize: 32, fontWeight: "800" },
  sub: { color: colors.onSurfaceTertiary, fontSize: 15, marginTop: 6 },
});

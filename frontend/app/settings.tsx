import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Button } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>SETTINGS</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        <Card>
          <Text style={styles.sec}>ACCOUNT</Text>
          <Row icon="person-outline" label="Edit Profile" onPress={() => router.push("/edit-profile")} />
          <Row icon="phone-portrait-outline" label="Devices & Sessions" onPress={() => router.push("/devices")} />
          <Row icon="key-outline" label="Change Password" onPress={() => router.push("/(auth)/forgot-password")} />
        </Card>
        <Card>
          <Text style={styles.sec}>SUPPORT & LEGAL</Text>
          <Row icon="chatbubbles-outline" label="Contact Support" onPress={() => router.push("/support")} />
          <Row icon="book-outline" label="Rules & FAQ" onPress={() => router.push("/rules")} />
        </Card>
        <View style={{ marginTop: spacing.md }}>
          <Button testID="settings-signout" title="Sign Out" variant="danger" onPress={signOut} />
        </View>
        <Text style={styles.version}>MatchPoint v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
function Row({ icon, label, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.onSurfaceSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  sec: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 1, fontWeight: "700", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  rowLabel: { flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  version: { color: colors.onSurfaceTertiary, fontSize: 11, textAlign: "center", marginTop: spacing.xl },
});

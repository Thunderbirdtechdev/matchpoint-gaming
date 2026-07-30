import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Empty, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function Notifications() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const load = async () => setItems(await api("/notifications"));
  useEffect(() => { load(); }, []);
  const markAll = async () => { await api("/notifications/read-all", { method: "POST" }); load(); };
  const iconFor = (kind: string) => ({
    deposit: "arrow-down-circle", withdrawal: "arrow-up-circle", prize_payout: "trophy",
    match_starting: "flash", match_results: "flag", tournament_registration: "ticket",
    support_update: "chatbubbles", friend_request: "person-add", promotion: "megaphone",
  }[kind] || "notifications");
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity testID="notif-back-btn" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>NOTIFICATIONS</Text>
          <TouchableOpacity testID="notif-mark-all-btn" onPress={markAll}><Text style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>MARK ALL</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 20, gap: spacing.sm }}>
        {items.length === 0 ? <Empty title="You're all caught up" subtitle="New activity will appear here." /> : items.map(n => (
          <Card key={n.id} style={{ backgroundColor: n.read ? colors.surfaceSecondary : colors.surfaceTertiary }}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={styles.icon}><Ionicons name={iconFor(n.kind) as any} size={18} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.msg}>{n.message}</Text>
                <Text style={styles.time}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
              {!n.read && <View style={styles.dot} />}
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  msg: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  time: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, alignSelf: "center" },
});

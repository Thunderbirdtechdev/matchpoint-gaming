import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, Empty, Button } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function Devices() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const load = async () => setItems(await api("/auth/sessions"));
  useEffect(() => { load(); }, []);
  const revoke = async (id: string) => { await api(`/auth/sessions/${id}/revoke`, { method: "POST" }); load(); };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>DEVICES</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        {items.length === 0 ? <Empty title="No active sessions" /> : items.map(s => (
          <Card key={s.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, flex: 1 }}>
                <View style={styles.icon}><Ionicons name="phone-portrait" size={18} color={colors.brand} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{s.device_name}</Text>
                  <Text style={styles.date}>Last seen: {new Date(s.last_seen).toLocaleString()}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => revoke(s.id)}><Text style={{ color: colors.error, fontWeight: "700" }}>REVOKE</Text></TouchableOpacity>
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
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  date: { color: colors.onSurfaceTertiary, fontSize: 12, marginTop: 2 },
});

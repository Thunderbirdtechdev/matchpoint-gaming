import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";

export default function Rules() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rules, setRules] = useState<any[]>([]);
  useEffect(() => { api<any>("/rules").then(r => setRules(r.sections)); }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>RULES</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
        {rules.map((s, i) => (
          <Card key={i}>
            <Text style={styles.h}>{s.title}</Text>
            <Text style={styles.b}>{s.content}</Text>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  h: { color: colors.brand, fontSize: 16, fontWeight: "800" },
  b: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
});

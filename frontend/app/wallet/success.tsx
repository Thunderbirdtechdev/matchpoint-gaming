import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { useAuth } from "@/src/auth";
import { api } from "@/src/api";

export default function DepositSuccess() {
  const router = useRouter();
  const { session_id } = useLocalSearchParams<{ session_id?: string }>();
  const { refresh } = useAuth();

  useEffect(() => {
    (async () => {
      if (session_id) {
        try { await api(`/wallet/deposit/status/${session_id}`); } catch {}
      }
      await refresh();
    })();
  }, [session_id, refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
      <View style={styles.checkCircle}><Ionicons name="checkmark" size={48} color={colors.onBrandPrimary} /></View>
      <Text style={styles.title}>Deposit Complete</Text>
      <Text style={styles.sub}>Your funds have been added to your MatchPoint wallet.</Text>
      <View style={{ marginTop: spacing.xxl, width: "100%" }}>
        <Button testID="deposit-success-done" title="Back to Wallet" onPress={() => router.replace("/(tabs)/wallet")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  checkCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: 24, fontWeight: "900", marginTop: spacing.xl },
  sub: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, textAlign: "center" },
});

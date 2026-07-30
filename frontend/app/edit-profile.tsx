import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, Button, styles_shared } from "@/src/components/ui";
import { colors, spacing } from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const GAMES = ["FIFA 25", "Call of Duty", "Fortnite", "Rocket League", "Street Fighter 6", "Valorant", "Apex Legends", "Mortal Kombat 1"];

export default function EditProfile() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [favs, setFavs] = useState<string[]>(user?.favorite_games || []);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const toggle = (g: string) => setFavs(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  const save = async () => {
    setErr(""); setBusy(true);
    try { await api("/profile", { method: "PATCH", body: JSON.stringify({ username, bio, favorite_games: favs }) }); await refresh(); router.back(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>EDIT PROFILE</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 + insets.bottom }} bottomOffset={120}>
        <View>
          <Text style={styles_shared.label}>USERNAME</Text>
          <TextInput testID="edit-username" style={styles_shared.input} value={username} onChangeText={setUsername} placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        <View>
          <Text style={styles_shared.label}>BIO</Text>
          <TextInput testID="edit-bio" style={[styles_shared.input, { minHeight: 80, textAlignVertical: "top" }]} value={bio} onChangeText={setBio} multiline placeholder="Tell everyone about your gaming style" placeholderTextColor={colors.onSurfaceTertiary} />
        </View>
        <View>
          <Text style={styles_shared.label}>FAVORITE GAMES</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {GAMES.map(g => <Chip key={g} label={g} active={favs.includes(g)} onPress={() => toggle(g)} />)}
          </View>
        </View>
        {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
      </KeyboardAwareScrollView>
      <KeyboardStickyView>
        <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
          <Button testID="edit-save-btn" title="Save Changes" onPress={save} loading={busy} />
        </View>
      </KeyboardStickyView>
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
});

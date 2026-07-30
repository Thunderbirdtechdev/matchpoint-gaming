import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Ionicons } from "@expo/vector-icons";
import { Card, Chip, Empty, Button, styles_shared, Pill } from "@/src/components/ui";
import { colors, spacing, radius } from "@/src/theme";
import { api } from "@/src/api";

export default function Support() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"tickets" | "new" | "faq">("tickets");
  const [tickets, setTickets] = useState<any[]>([]);
  const [faq, setFaq] = useState<any[]>([]);
  const [subject, setSubject] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");

  const load = async () => {
    setTickets(await api("/support/tickets"));
    setFaq(await api("/faq"));
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      await api("/support/tickets", { method: "POST", body: JSON.stringify({ subject, message, category: "general" }) });
      setSubject(""); setMessage(""); setTab("tickets"); load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></TouchableOpacity>
          <Text style={styles.title}>SUPPORT</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={{ flexDirection: "row", paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.sm }}>
          <Chip label="My Tickets" active={tab === "tickets"} onPress={() => setTab("tickets")} testID="support-tab-tickets" />
          <Chip label="New Ticket" active={tab === "new"} onPress={() => setTab("new")} testID="support-tab-new" />
          <Chip label="FAQ" active={tab === "faq"} onPress={() => setTab("faq")} testID="support-tab-faq" />
        </View>
      </SafeAreaView>

      {tab === "new" ? (
        <View style={{ flex: 1 }}>
          <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} bottomOffset={100}>
            <View>
              <Text style={styles_shared.label}>SUBJECT</Text>
              <TextInput testID="ticket-subject-input" style={styles_shared.input} value={subject} onChangeText={setSubject} placeholder="Brief summary" placeholderTextColor={colors.onSurfaceTertiary} />
            </View>
            <View>
              <Text style={styles_shared.label}>MESSAGE</Text>
              <TextInput testID="ticket-message-input" style={[styles_shared.input, { minHeight: 120, textAlignVertical: "top" }]} value={message} onChangeText={setMessage} multiline placeholder="Describe your issue..." placeholderTextColor={colors.onSurfaceTertiary} />
            </View>
            {err ? <Text style={{ color: colors.error }}>{err}</Text> : null}
          </KeyboardAwareScrollView>
          <KeyboardStickyView>
            <View style={[styles.stickyBar, { paddingBottom: 16 + insets.bottom }]}>
              <Button testID="ticket-submit-btn" title="Submit Ticket" onPress={submit} loading={busy} />
            </View>
          </KeyboardStickyView>
        </View>
      ) : tab === "faq" ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
          {faq.map((f, i) => (
            <Card key={i}>
              <Text style={styles.q}>{f.q}</Text>
              <Text style={styles.a}>{f.a}</Text>
            </Card>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 20 }}>
          {tickets.length === 0 ? <Empty title="No tickets yet" subtitle="Open a new ticket to get help." /> : tickets.map(t => (
            <Card key={t.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                <Pill label={t.status} tone={t.status === "open" ? "warning" : "success"} />
                <Text style={styles.ticketDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.ticketSubj}>{t.subject}</Text>
              <Text style={styles.ticketMsg}>{t.message}</Text>
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.lg },
  title: { color: colors.onSurface, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  stickyBar: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  q: { color: colors.brand, fontSize: 14, fontWeight: "800" },
  a: { color: colors.onSurfaceSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
  ticketDate: { color: colors.onSurfaceTertiary, fontSize: 11 },
  ticketSubj: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  ticketMsg: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 4 },
});

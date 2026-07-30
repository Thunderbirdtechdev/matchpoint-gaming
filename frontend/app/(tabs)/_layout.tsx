import { Tabs, Redirect } from "expo-router";
import { View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const insets = useSafeAreaInsets();

  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.is_admin) return <Redirect href="/admin" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
        tabBarStyle: {
          position: "absolute",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: Platform.OS === "ios" ? "rgba(17,18,16,0.85)" : colors.surface,
          height: 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom || 8,
        },
        tabBarBackground: Platform.OS === "ios" ? () => (
          <BlurView tint="dark" intensity={80} style={{ flex: 1 }} />
        ) : undefined,
      }}
    >
      <Tabs.Screen name="home" options={{ title: "HOME", tabBarIcon: ({ color, size }) => <Ionicons name="flash" size={size} color={color} /> }} />
      <Tabs.Screen name="tournaments" options={{ title: "EVENTS", tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }} />
      <Tabs.Screen name="play" options={{ title: "PLAY", tabBarIcon: ({ color, size }) => <Ionicons name="game-controller" size={size} color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "WALLET", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "PROFILE", tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} /> }} />
    </Tabs>
  );
}

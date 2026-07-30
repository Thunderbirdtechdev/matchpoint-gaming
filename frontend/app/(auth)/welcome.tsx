import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Button } from "@/src/components/ui";
import { LogoWithWordmark } from "@/src/components/logo";
import { colors, spacing } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ImageBackground
        source={{ uri: "https://images.pexels.com/photos/7915213/pexels-photo-7915213.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" }}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <LinearGradient
          colors={["rgba(17,18,16,0.6)", "rgba(17,18,16,0.9)", colors.surface]}
          style={{ flex: 1 }}
        >
          <SafeAreaView style={{ flex: 1, justifyContent: "space-between", padding: spacing.xl }}>
            <View style={{ marginTop: spacing.xxl, alignItems: "center" }}>
              <LogoWithWordmark size={96} />
              <Text style={styles.tagline}>COMPETE · WIN · CASH OUT</Text>
            </View>
            <View style={{ gap: spacing.md }}>
              <Text style={styles.h1}>Skill-based{"\n"}competitive gaming.</Text>
              <Text style={styles.sub}>Challenge players head-to-head, join tournaments, and get automatic payouts to your MatchPoint wallet.</Text>
              <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
                <Button testID="welcome-get-started-btn" title="Get Started" onPress={() => router.push("/(auth)/register")} />
                <Button testID="welcome-sign-in-btn" title="I have an account" variant="ghost" onPress={() => router.push("/(auth)/login")} />
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  tagline: { color: colors.brand, fontSize: 12, letterSpacing: 3, marginTop: spacing.md, fontWeight: "700" },
  h1: { color: colors.onSurface, fontSize: 42, fontWeight: "900", lineHeight: 46, letterSpacing: -0.5 },
  sub: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.sm },
});

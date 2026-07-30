import { View, Text, StyleSheet, Image } from "react-native";
import { colors } from "@/src/theme";

const LOGO = require("../../assets/images/logo.png");

export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size, resizeMode: "contain" }} />;
}

export function LogoWithWordmark({ size = 48 }: { size?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Image source={LOGO} style={{ width: size, height: size, resizeMode: "contain" }} />
      <Text style={styles.wordmark}>MATCH<Text style={{ color: colors.brand }}>POINT</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { color: colors.onSurface, fontSize: 20, fontWeight: "900", letterSpacing: 3, marginTop: 8 },
});

import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, radius } from "@/src/theme";

export function ScreenBg({ children }: { children: React.ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: colors.surface }}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

type BtnProps = {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  testID?: string;
  small?: boolean;
};

export function Button({ title, onPress, variant = "primary", disabled, loading, style, testID, small }: BtnProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const bg = isPrimary ? colors.brand : isDanger ? colors.error : isGhost ? "transparent" : colors.surfaceTertiary;
  const fg = isPrimary || isDanger ? colors.onBrandPrimary : isGhost ? colors.brand : colors.onSurface;
  const borderColor = isGhost ? colors.brand : "transparent";
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: bg,
          paddingVertical: small ? 10 : 14,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: isGhost ? 1 : 0,
          borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 13 : 15, letterSpacing: 0.5 }}>
          {title.toUpperCase()}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingHorizontal: spacing.lg,
        height: 36,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.brand : colors.border,
        backgroundColor: active ? colors.brandTertiary : colors.surfaceSecondary,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Text style={{ color: active ? colors.brand : colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Pill({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" | "danger" | "brand" }) {
  const toneMap = {
    default: { bg: colors.surfaceTertiary, fg: colors.onSurfaceSecondary },
    success: { bg: "rgba(16,185,129,0.15)", fg: colors.success },
    warning: { bg: "rgba(245,158,11,0.15)", fg: colors.warning },
    danger: { bg: "rgba(239,68,68,0.15)", fg: colors.error },
    brand: { bg: colors.brandTertiary, fg: colors.brand },
  }[tone];
  return (
    <View style={{ backgroundColor: toneMap.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" }}>
      <Text style={{ color: toneMap.fg, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Empty({ title, subtitle, testID }: { title: string; subtitle?: string; testID?: string }) {
  return (
    <View testID={testID} style={{ alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
      <Text style={{ color: colors.brand, fontSize: 40, marginBottom: spacing.md }}>◈</Text>
      <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", textAlign: "center" }}>{title}</Text>
      {subtitle ? <Text style={{ color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center", marginTop: 6 }}>{subtitle}</Text> : null}
    </View>
  );
}

export function GradientScrim({ children, height = 200 }: { children?: React.ReactNode; height?: number }) {
  return (
    <LinearGradient
      colors={["transparent", "rgba(17,18,16,0.9)", colors.surface]}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height }}
    >
      {children}
    </LinearGradient>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md, marginTop: spacing.lg }}>
      <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 0.5 }}>{title}</Text>
      {action}
    </View>
  );
}

export function Header({ title, right, testID }: { title: string; right?: React.ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.header}>
      <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "800", letterSpacing: 1 }}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});

export const styles_shared = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    color: colors.onSurface,
    fontSize: 15,
  },
  label: { color: colors.onSurfaceTertiary, fontSize: 12, letterSpacing: 0.8, fontWeight: "700", marginBottom: 8 },
});

export const colors = {
  surface: "#111210",
  onSurface: "#F4F5F0",
  surfaceSecondary: "#191B18",
  onSurfaceSecondary: "#D1D5CB",
  surfaceTertiary: "#21251F",
  onSurfaceTertiary: "#9CA394",
  surfaceInverse: "#F4F5F0",
  onSurfaceInverse: "#111210",
  brand: "#CCFF00",
  brandPrimary: "#CCFF00",
  onBrandPrimary: "#000000",
  brandSecondary: "#99CC00",
  brandTertiary: "#293300",
  onBrandTertiary: "#CCFF00",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  border: "#2C3129",
  borderStrong: "#3F463B",
  divider: "#1E221C",
  overlay: "rgba(0,0,0,0.6)",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
export const font = {
  display: "System" as const, // Rajdhani requires custom font load; fallback system
  text: "System" as const,
  weightBold: "700" as const,
  weightSemi: "600" as const,
  weightMed: "500" as const,
};

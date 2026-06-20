export const brand = {
  primary: '#2563EB',
  primaryDark: '#1d4ed8',
  violet: '#7C3AED',
  gold: '#FBBF24',
  dark: '#0f172a',
  text: '#475569',
  textLight: '#94a3b8',
  white: '#ffffff',
  surface: '#f8fafc',
  border: '#e2e8f0',
}

export const main = {
  backgroundColor: brand.white,
  fontFamily: '"Inter", Arial, sans-serif',
}

export const container = {
  padding: '0',
  maxWidth: '600px',
  margin: '0 auto',
}

export const headerBar = {
  background: `linear-gradient(135deg, ${brand.primary} 0%, ${brand.violet} 100%)`,
  padding: '24px 25px',
  textAlign: 'center' as const,
}

export const headerTitle = {
  color: brand.white,
  fontSize: '20px',
  fontWeight: '700' as const,
  margin: '0',
  fontFamily: '"Orbitron", "Rajdhani", Arial, sans-serif',
  letterSpacing: '0.05em',
}

export const bodyWrapper = {
  padding: '32px 25px',
  backgroundColor: brand.white,
}

export const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: brand.dark,
  margin: '0 0 16px',
  fontFamily: '"Orbitron", "Rajdhani", Arial, sans-serif',
}

export const text = {
  fontSize: '14px',
  color: brand.text,
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const link = {
  color: brand.primary,
  textDecoration: 'underline',
}

export const button = {
  backgroundColor: brand.primary,
  color: brand.white,
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}

export const footer = {
  fontSize: '12px',
  color: brand.textLight,
  margin: '24px 0 0',
  borderTop: `1px solid ${brand.border}`,
  paddingTop: '16px',
}

export const codeStyle = {
  fontFamily: '"Rajdhani", "Courier New", monospace',
  fontSize: '28px',
  fontWeight: '700' as const,
  color: brand.dark,
  letterSpacing: '0.15em',
  textAlign: 'center' as const,
  padding: '16px 24px',
  backgroundColor: brand.surface,
  borderRadius: '8px',
  border: `1px solid ${brand.border}`,
  margin: '0 auto 24px',
  display: 'inline-block' as const,
}

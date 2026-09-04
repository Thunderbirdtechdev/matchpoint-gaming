/**
 * Module 10 — the shared email shell.
 *
 * The four templates that predate this module each carry their own copy of the
 * Html/Head/Preview/Body/Container/header/footer scaffolding. That was fine at
 * four and would not be at thirteen: the next change to the header would mean
 * thirteen edits, and the one that got missed would ship a broken email nobody
 * sees until a player forwards it.
 *
 * The existing four are deliberately left alone — they work, they are already
 * sent in production, and rewriting live email templates to save duplication is
 * a bad trade. New templates use this.
 *
 * Design comes from `./styles.ts`, unchanged.
 */

import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import {
  brand,
  bodyWrapper,
  button,
  container,
  footer,
  h1,
  headerBar,
  headerTitle,
  main,
  text,
} from "./styles";

const SITE = "https://matchpointgaming.org";

export function EmailShell({
  preview,
  title,
  tone = brand.dark,
  intro,
  cta,
  children,
}: {
  preview: string;
  title: string;
  /** Accent for the headline. Green for good news, red for bad, brand otherwise. */
  tone?: string;
  intro?: string;
  cta?: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerBar}>
            <Heading style={headerTitle}>MATCHPOINT GAMING</Heading>
          </Section>
          <Section style={bodyWrapper}>
            <Heading as="h1" style={{ ...h1, color: tone }}>
              {title}
            </Heading>
            {intro ? <Text style={text}>{intro}</Text> : null}

            {children}

            {cta ? (
              <Section style={{ margin: "8px 0 4px" }}>
                <Button style={button} href={cta.href}>
                  {cta.label}
                </Button>
              </Section>
            ) : null}

            <Hr style={{ borderColor: brand.border, margin: "24px 0 12px" }} />
            <Text style={footer}>MatchPoint Gaming · matchpointgaming.org</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The bordered detail block used by every transactional template. */
export function DetailCard({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        border: `1px solid ${brand.border}`,
        borderRadius: 8,
        padding: "16px 18px",
        margin: "8px 0 20px",
        backgroundColor: brand.surface,
      }}
    >
      {children}
    </Section>
  );
}

/** A label/value line inside a DetailCard. Renders nothing when the value is absent. */
export function Detail({ label, value }: { label: string; value?: string | null }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <Text style={{ ...text, margin: "4px 0", fontSize: 13 }}>
      <strong>{label}:</strong> {value}
    </Text>
  );
}

/** A big headline figure — a prize, a stake, a balance. */
export function Amount({
  label,
  value,
  tone = brand.dark,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <Column>
      <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>{label}</Text>
      <Text style={{ ...text, margin: "2px 0 12px", fontWeight: 700, fontSize: 18, color: tone }}>
        {value}
      </Text>
    </Column>
  );
}

export { Row, brand, text, SITE };

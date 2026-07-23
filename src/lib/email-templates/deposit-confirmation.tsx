import React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  brand, bodyWrapper, container, footer, h1, headerBar, headerTitle, main, text,
} from './styles'

interface Props {
  amountFormatted?: string
  currency?: string
  newBalanceFormatted?: string
  sessionId?: string
}

const Email = ({
  amountFormatted = '$0.00',
  currency = 'USD',
  newBalanceFormatted,
  sessionId,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Deposit confirmed — {amountFormatted} added to your wallet</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading style={headerTitle}>MATCHPOINT GAMING</Heading>
        </Section>
        <Section style={bodyWrapper}>
          <Heading as="h1" style={{ ...h1, color: '#16a34a' }}>Deposit confirmed</Heading>
          <Text style={text}>
            Your deposit landed successfully and your MatchPoint wallet is ready to play.
          </Text>
          <Section
            style={{
              border: `1px solid ${brand.border}`,
              borderRadius: 8,
              padding: '16px 18px',
              margin: '8px 0 20px',
              backgroundColor: brand.surface,
            }}
          >
            <Row>
              <Column>
                <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>Amount</Text>
                <Text style={{ ...text, margin: '2px 0 12px', fontWeight: 700, fontSize: 18, color: brand.dark }}>
                  {amountFormatted} {currency.toUpperCase()}
                </Text>
              </Column>
              {newBalanceFormatted ? (
                <Column>
                  <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>New balance</Text>
                  <Text style={{ ...text, margin: '2px 0 12px', fontWeight: 700, fontSize: 18, color: brand.primary }}>
                    {newBalanceFormatted}
                  </Text>
                </Column>
              ) : null}
            </Row>
            {sessionId ? (
              <Text style={{ ...text, margin: '4px 0 0', fontSize: 12, color: brand.textLight }}>
                Ref: {sessionId}
              </Text>
            ) : null}
          </Section>
          <Text style={text}>Jump back in and find your next match.</Text>
          <Hr style={{ borderColor: brand.border, margin: '24px 0 12px' }} />
          <Text style={footer}>MatchPoint Gaming · matchpointgaming.org</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    d?.amountFormatted ? `Deposit confirmed · ${d.amountFormatted}` : 'Deposit confirmed',
  displayName: 'Deposit confirmation',
  previewData: {
    amountFormatted: '$50.00',
    currency: 'usd',
    newBalanceFormatted: '$125.00',
    sessionId: 'cs_test_example',
  },
} satisfies TemplateEntry

export default Email

import React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  brand, bodyWrapper, container, footer, h1, headerBar, headerTitle, main, text,
} from './styles'

export type UserPayoutStatus =
  | 'requested'
  | 'processing'
  | 'paid'
  | 'rejected'

interface Props {
  status?: UserPayoutStatus
  method?: 'paypal' | 'cashapp'
  speed?: 'standard' | 'same_day'
  handle?: string
  grossFormatted?: string
  feeFormatted?: string
  netFormatted?: string
  requestId?: string
  adminNote?: string | null
}

const COPY: Record<UserPayoutStatus, { title: string; preview: string; intro: string; tone: string }> = {
  requested: {
    title: 'Payout request received',
    preview: 'We got your payout request.',
    intro: "We've received your payout request and it's in the queue.",
    tone: brand.primary,
  },
  processing: {
    title: 'Payout is processing',
    preview: 'Your payout is being processed.',
    intro: 'Our team is processing your payout right now.',
    tone: brand.primary,
  },
  paid: {
    title: 'Payout sent',
    preview: 'Your payout has been sent.',
    intro: 'Good news — your payout has been sent. It should arrive shortly.',
    tone: '#16a34a',
  },
  rejected: {
    title: 'Payout canceled',
    preview: 'Your payout was canceled and refunded.',
    intro: 'Your payout could not be completed and the funds have been refunded to your wallet.',
    tone: '#dc2626',
  },
}

const Email = ({
  status = 'requested',
  method = 'paypal',
  speed = 'standard',
  handle,
  grossFormatted = '$0.00',
  feeFormatted,
  netFormatted,
  requestId,
  adminNote,
}: Props) => {
  const copy = COPY[status] ?? COPY.requested
  const methodLabel = method === 'paypal' ? 'PayPal' : 'Cash App'
  const speedLabel = speed === 'same_day' ? 'Same-day (30 min – 5 hours)' : 'Standard (2–5 business days)'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={headerBar}>
            <Heading style={headerTitle}>MATCHPOINT GAMING</Heading>
          </Section>
          <Section style={bodyWrapper}>
            <Heading as="h1" style={{ ...h1, color: copy.tone }}>{copy.title}</Heading>
            <Text style={text}>{copy.intro}</Text>

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
                    {grossFormatted}
                  </Text>
                </Column>
                {netFormatted ? (
                  <Column>
                    <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>You receive</Text>
                    <Text style={{ ...text, margin: '2px 0 12px', fontWeight: 700, fontSize: 18, color: copy.tone }}>
                      {netFormatted}
                    </Text>
                  </Column>
                ) : null}
              </Row>
              <Hr style={{ borderColor: brand.border, margin: '6px 0 10px' }} />
              <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                <strong>Method:</strong> {methodLabel}{handle ? ` — ${handle}` : ''}
              </Text>
              <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                <strong>Speed:</strong> {speedLabel}
              </Text>
              {feeFormatted ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                  <strong>Fee:</strong> {feeFormatted}
                </Text>
              ) : null}
              {requestId ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 12, color: brand.textLight }}>
                  Ref: {requestId}
                </Text>
              ) : null}
              {adminNote ? (
                <Text style={{ ...text, margin: '8px 0 0', fontSize: 13 }}>
                  <strong>Note:</strong> {adminNote}
                </Text>
              ) : null}
            </Section>

            <Hr style={{ borderColor: brand.border, margin: '24px 0 12px' }} />
            <Text style={footer}>MatchPoint Gaming · matchpointgaming.org</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => {
    const status = (d?.status as UserPayoutStatus) ?? 'requested'
    const copy = COPY[status] ?? COPY.requested
    return d?.grossFormatted ? `${copy.title} · ${d.grossFormatted}` : copy.title
  },
  displayName: 'Payout update',
  previewData: {
    status: 'requested',
    method: 'paypal',
    speed: 'standard',
    handle: 'player@example.com',
    grossFormatted: '$50.00',
    feeFormatted: '$0.00',
    netFormatted: '$50.00',
    requestId: 'req_preview',
  },
} satisfies TemplateEntry

export default Email

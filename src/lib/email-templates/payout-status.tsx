import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Column,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  brand,
  bodyWrapper,
  container,
  footer,
  h1,
  headerBar,
  headerTitle,
  main,
  text,
} from './styles'

export type PayoutStatus =
  | 'initiated'
  | 'in_transit'
  | 'paid'
  | 'failed'
  | 'canceled'

export interface PayoutStatusEmailProps {
  status?: PayoutStatus
  amountFormatted?: string
  currency?: string
  payoutId?: string
  initiatedBy?: string
  arrivalDate?: string | null
  note?: string | null
  stripeBalanceFormatted?: string | null
  failureReason?: string | null
}

const STATUS_COPY: Record<
  PayoutStatus,
  { title: string; preview: string; intro: string; tone: string }
> = {
  initiated: {
    title: 'Payout initiated',
    preview: 'A new bank payout has been started.',
    intro: 'A withdrawal to your linked business bank account has been initiated.',
    tone: brand.primary,
  },
  in_transit: {
    title: 'Payout in transit',
    preview: 'Your payout is on its way to your bank.',
    intro: 'Your payout is moving from Stripe to your business bank account.',
    tone: brand.primary,
  },
  paid: {
    title: 'Payout sent',
    preview: 'Your payout has landed in your bank account.',
    intro: 'Your payout has been completed and deposited into your linked business bank account.',
    tone: '#16a34a',
  },
  failed: {
    title: 'Payout failed',
    preview: 'Your most recent payout could not be completed.',
    intro: 'Your most recent payout did not go through. The funds remain in your Stripe balance.',
    tone: '#dc2626',
  },
  canceled: {
    title: 'Payout canceled',
    preview: 'Your payout was canceled.',
    intro: 'Your payout was canceled before it reached your bank.',
    tone: brand.text,
  },
}

const Email = ({
  status = 'initiated',
  amountFormatted = '$0.00',
  currency = 'USD',
  payoutId = 'po_preview',
  initiatedBy,
  arrivalDate,
  note,
  stripeBalanceFormatted,
  failureReason,
}: PayoutStatusEmailProps) => {
  const copy = STATUS_COPY[status] ?? STATUS_COPY.initiated
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
            <Heading as="h1" style={{ ...h1, color: copy.tone }}>
              {copy.title}
            </Heading>
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
                  <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>
                    Amount
                  </Text>
                  <Text style={{ ...text, margin: '2px 0 12px', fontWeight: 700, fontSize: 18, color: brand.dark }}>
                    {amountFormatted} {currency.toUpperCase()}
                  </Text>
                </Column>
                <Column>
                  <Text style={{ ...text, margin: 0, fontSize: 12, color: brand.textLight }}>
                    Status
                  </Text>
                  <Text style={{ ...text, margin: '2px 0 12px', fontWeight: 700, fontSize: 18, color: copy.tone, textTransform: 'capitalize' }}>
                    {status.replace('_', ' ')}
                  </Text>
                </Column>
              </Row>
              <Hr style={{ borderColor: brand.border, margin: '6px 0 10px' }} />
              <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                <strong>Payout ID:</strong> {payoutId}
              </Text>
              {arrivalDate ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                  <strong>Expected arrival:</strong> {arrivalDate}
                </Text>
              ) : null}
              {initiatedBy ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                  <strong>Initiated by:</strong> {initiatedBy}
                </Text>
              ) : null}
              {stripeBalanceFormatted ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                  <strong>Stripe balance after:</strong> {stripeBalanceFormatted}
                </Text>
              ) : null}
              {note ? (
                <Text style={{ ...text, margin: '4px 0', fontSize: 13 }}>
                  <strong>Note:</strong> {note}
                </Text>
              ) : null}
              {failureReason ? (
                <Text style={{ ...text, margin: '8px 0 0', fontSize: 13, color: '#dc2626' }}>
                  <strong>Reason:</strong> {failureReason}
                </Text>
              ) : null}
            </Section>

            <Text style={{ ...text, fontSize: 12, color: brand.textLight }}>
              This is an automated notification for your MatchPoint Gaming admin team.
            </Text>
            <Hr style={{ borderColor: brand.border, margin: '24px 0 12px' }} />
            <Text style={footer}>
              MatchPoint Gaming · Admin notifications
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const status = (data?.status as PayoutStatus) ?? 'initiated'
    const amount = data?.amountFormatted ?? ''
    const copy = STATUS_COPY[status] ?? STATUS_COPY.initiated
    return amount ? `${copy.title} · ${amount}` : copy.title
  },
  displayName: 'Payout status',
  previewData: {
    status: 'paid',
    amountFormatted: '$1,250.00',
    currency: 'usd',
    payoutId: 'po_1QExample',
    initiatedBy: 'admin@matchpointgaming.org',
    arrivalDate: 'Jun 23, 2026',
    stripeBalanceFormatted: '$320.00',
    note: 'Weekly sweep',
  },
} satisfies TemplateEntry

export default Email

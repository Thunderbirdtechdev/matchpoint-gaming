import React from 'react'
import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'
import {
  brand, bodyWrapper, container, footer, h1, headerBar, headerTitle, main, text,
} from './styles'

interface Props {
  email?: string
}

const Email = ({ email }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the MatchPoint Gaming waitlist</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar}>
          <Heading style={headerTitle}>MATCHPOINT GAMING</Heading>
        </Section>
        <Section style={bodyWrapper}>
          <Heading as="h1" style={h1}>You're on the list 🎮</Heading>
          <Text style={text}>
            Thanks for joining the MatchPoint Gaming waitlist{email ? ` with ${email}` : ''}.
            We're putting the finishing touches on the platform and you'll be one of the first
            to know the moment we go live.
          </Text>
          <Text style={text}>
            What's coming: skill-based 1v1 challenges, cash tournaments, instant escrow, and
            same-day payouts on top of Warzone, Fortnite, NBA 2K, Madden, Rocket League, and more.
          </Text>
          <Text style={text}>
            Sit tight — we'll email you the second early access opens.
          </Text>
          <Hr style={{ borderColor: brand.border, margin: '24px 0 12px' }} />
          <Text style={footer}>MatchPoint Gaming · matchpointgaming.org</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: "You're on the MatchPoint waitlist",
  displayName: 'Waitlist welcome',
  previewData: { email: 'player@example.com' },
} satisfies TemplateEntry

export default Email

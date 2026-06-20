import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

import {
  main,
  container,
  headerBar,
  headerTitle,
  bodyWrapper,
  h1,
  text,
  button,
  footer,
} from './styles'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={headerBar}>
          <Text style={headerTitle}>MATCHPOINT</Text>
        </div>
        <div style={bodyWrapper}>
          <Heading style={h1}>Your login link</Heading>
          <Text style={text}>
            Click the button below to log in to {siteName}. This link will expire
            shortly.
          </Text>
          <Button style={button} href={confirmationUrl}>
            Log In
          </Button>
          <Text style={footer}>
            If you didn't request this link, you can safely ignore this email.
          </Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

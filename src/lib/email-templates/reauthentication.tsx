import * as React from 'react'

import {
  Body,
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
  footer,
  codeStyle,
} from './styles'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={headerBar}>
          <Text style={headerTitle}>MATCHPOINT</Text>
        </div>
        <div style={bodyWrapper}>
          <Heading style={h1}>Confirm reauthentication</Heading>
          <Text style={text}>Use the code below to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            This code will expire shortly. If you didn't request this, you can
            safely ignore this email.
          </Text>
        </div>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

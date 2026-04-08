import * as React from 'react'
import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components'
import type { EmailContext } from './types'

const containerStyle: React.CSSProperties = {
  margin: '0 auto',
  padding: '20px',
  maxWidth: '660px',
}

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  color: '#000000',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
}

const lineStyle: React.CSSProperties = {
  margin: 0,
  padding: 0,
  fontSize: '14px',
  lineHeight: '20px',
}

function MailHeader({ ctx }: { ctx: EmailContext }) {
  const { settings } = ctx
  return (
    <Section style={{ padding: '16px 0' }}>
      <Row>
        <Column align="center">
          <Link href={settings.baseUrl}>
            {settings.logoUrl && settings.logoWidth && settings.logoHeight ? (
              <Img
                src={settings.logoUrl}
                width={150}
                height={(settings.logoHeight / settings.logoWidth) * 150}
                alt={settings.shopName}
                style={{ display: 'block', margin: '0 auto' }}
              />
            ) : (
              <Text style={{ ...lineStyle, fontWeight: 700, fontSize: '20px' }}>
                {settings.shopName}
              </Text>
            )}
          </Link>
        </Column>
      </Row>
    </Section>
  )
}

function MailFooter({ ctx }: { ctx: EmailContext }) {
  const { settings, locale } = ctx
  const address = settings.billingAddress
  const countryName = address?.country
    ? new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
    : null
  return (
    <Section style={{ marginTop: '56px', padding: '16px 0' }}>
      <Row>
        <Column align="center">
          <Hr style={{ margin: '16px 0', borderColor: '#eeeeee' }} />
          <Text style={{ ...lineStyle, fontWeight: 700, fontSize: '16px' }}>
            {settings.shopName}
          </Text>
          {address && (
            <>
              <Text style={lineStyle}>{address.line1}</Text>
              {address.line2 && <Text style={lineStyle}>{address.line2}</Text>}
              <Text style={lineStyle}>
                {address.zip} {address.city}
              </Text>
              {countryName && <Text style={lineStyle}>{countryName}</Text>}
            </>
          )}
          <Link
            href={`mailto:${settings.senderEmail}`}
            style={{ ...lineStyle, color: '#000000', textDecoration: 'underline' }}
          >
            {settings.senderEmail}
          </Link>
        </Column>
      </Row>
    </Section>
  )
}

export function BaseMailTemplate({
  ctx,
  children,
}: {
  ctx: EmailContext
  children: React.ReactNode
}) {
  return (
    <Html lang={ctx.locale}>
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <MailHeader ctx={ctx} />
          {children}
          <MailFooter ctx={ctx} />
        </Container>
      </Body>
    </Html>
  )
}

export { lineStyle, containerStyle }

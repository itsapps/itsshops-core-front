import * as React from 'react'
import { Button, Section, Text } from '@react-email/components'
import { BaseMailTemplate, lineStyle } from './baseMailTemplate'
import type { SimpleEmailProps } from './types'

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '4px',
  display: 'inline-block',
}

/**
 * Plain text email template — used for non-order-summary notifications such as
 * refund confirmations and auth emails (signup confirm, password reset, invite).
 * Renders a single headline + paragraph body inside the shared shell, plus an
 * optional CTA button below the text.
 */
export function SimpleMailTemplate({ ctx, headline, text, cta }: SimpleEmailProps) {
  const lines = text.split('\n')
  return (
    <BaseMailTemplate ctx={ctx}>
      <Section style={{ padding: '16px 0' }}>
        {headline && (
          <Text style={{ ...lineStyle, fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
            {headline}
          </Text>
        )}
        {lines.map((line, i) => (
          <Text key={i} style={{ ...lineStyle, marginBottom: '8px' }}>
            {line}
          </Text>
        ))}
        {cta && (
          <Section style={{ padding: '16px 0', textAlign: 'center' }}>
            <Button href={cta.url} style={buttonStyle}>
              {cta.label}
            </Button>
          </Section>
        )}
      </Section>
    </BaseMailTemplate>
  )
}

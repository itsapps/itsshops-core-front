import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { BaseMailTemplate, lineStyle } from './baseMailTemplate'
import type { SimpleEmailProps } from './types'

/**
 * Plain text email template — used for non-order-summary notifications such as
 * refund confirmations. Renders a single headline + paragraph body inside the
 * shared shell.
 */
export function SimpleMailTemplate({ ctx, headline, text }: SimpleEmailProps) {
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
      </Section>
    </BaseMailTemplate>
  )
}

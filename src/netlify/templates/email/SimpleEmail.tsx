import * as React from 'react'
import { Section, Link } from '@react-email/components'
import { EmailLayout } from './EmailLayout'
import { EmailText, EmailHeading, EmailButton } from './components'
import { colors } from './tokens'
import type { SimpleEmailProps } from './types'

/**
 * Plain text email template — used for non-order-summary notifications such as
 * refund confirmations and auth emails (signup confirm, password reset, invite).
 * Renders a single headline + paragraph body inside the shared shell, plus an
 * optional CTA button below the text.
 */
export function SimpleEmail({ ctx, headline, text, cta, footerLink }: SimpleEmailProps) {
  const lines = text.split('\n')
  return (
    <EmailLayout ctx={ctx}>
      <Section style={{ padding: '16px 0' }}>
        {headline && <EmailHeading style={{ marginBottom: '12px' }}>{headline}</EmailHeading>}
        {lines.map((line, i) => (
          <EmailText key={i} style={{ marginBottom: '8px' }}>
            {line}
          </EmailText>
        ))}
        {cta && (
          <Section style={{ padding: '16px 0', textAlign: 'center' }}>
            <EmailButton fullWidth href={cta.url}>{cta.label}</EmailButton>
          </Section>
        )}
        {footerLink && (
          <EmailText muted align="center" size={13} style={{ marginTop: '8px' }}>
            <Link href={footerLink.url} style={{ color: colors.muted, textDecoration: 'underline' }}>
              {footerLink.label}
            </Link>
          </EmailText>
        )}
      </Section>
    </EmailLayout>
  )
}

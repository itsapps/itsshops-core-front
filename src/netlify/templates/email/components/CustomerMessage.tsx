import * as React from 'react'
import { Section } from '@react-email/components'
import { EmailText } from './EmailText'
import { colors } from '../tokens'

/**
 * Personal message the shop admin typed when sending the mail from the studio
 * (status change or manual mail). Plain text only — line breaks become
 * paragraphs; rendered as text, never as HTML. Renders nothing when empty.
 */
export function CustomerMessage({ text }: { text?: string }) {
  const message = text?.trim()
  if (!message) return null
  return (
    <Section
      style={{
        margin: '16px 0 8px',
        padding: '4px 0 4px 16px',
        borderLeft: `3px solid ${colors.border}`,
      }}
    >
      {message.split('\n').map((line, i) => (
        <EmailText key={i} style={{ marginBottom: '8px', minHeight: '20px' }}>
          {line}
        </EmailText>
      ))}
    </Section>
  )
}

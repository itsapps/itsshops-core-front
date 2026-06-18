import * as React from 'react'
import { Body, Container, Head, Html } from '@react-email/components'
import { MailHeader, MailFooter } from './components'
import { colors, fontFamily } from './tokens'
import type { EmailContext } from './types'

const bodyStyle: React.CSSProperties = {
  margin: 0,
  padding: '0 8px',
  backgroundColor: colors.background,
  fontFamily,
  fontSize: '16px',
}

const containerStyle: React.CSSProperties = {
  margin: '20px auto',
  padding: '20px',
  maxWidth: '600px',
  backgroundColor: colors.background,
  border: `1px solid ${colors.border}`,
  borderRadius: '16px',
}

type EmailLayoutProps = {
  ctx: EmailContext
  children: React.ReactNode
  /** Override the default shop header. */
  header?: React.ReactNode
  /** Override the default shop footer. */
  footer?: React.ReactNode
}

/**
 * Shared email shell: html document, light-mode meta, centered card container,
 * with a shop header and footer. `header`/`footer` are slots — pass your own to
 * replace the defaults without copying the shell.
 */
export function EmailLayout({
  ctx,
  children,
  header = <MailHeader settings={ctx.settings} />,
  footer = <MailFooter settings={ctx.settings} locale={ctx.locale} />,
}: EmailLayoutProps) {
  return (
    <Html lang={ctx.locale}>
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* {header} */}
          {children}
          {footer}
        </Container>
      </Body>
    </Html>
  )
}

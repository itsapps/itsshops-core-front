import * as React from 'react'
import { Column, Link, Row, Section } from '@react-email/components'
import { EmailText } from './EmailText'
import { colors } from '../tokens'
import type { EmailShopSettings } from '../types'

/**
 * Email footer — shop name, business address and a mailto link to the sender.
 */
export function MailFooter({
  settings,
  locale,
}: {
  settings: EmailShopSettings
  locale: string
}) {
  const address = settings.billingAddress
  const countryName = address?.country
    ? new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
    : null
  return (
    <Section style={{ marginTop: '48px', padding: '16px 0', borderTop: `1px solid ${colors.divider}` }}>
      <Row>
        <Column align="center">
          <EmailText bold size={18} style={{marginBottom: "8px"}}>
            {settings.shopName}
          </EmailText>
          {address && (
            <>
              <EmailText>{address.line1}</EmailText>
              {address.line2 && <EmailText>{address.line2}</EmailText>}
              <EmailText>
                {address.zip} {address.city}
              </EmailText>
              {countryName && <EmailText>{countryName}</EmailText>}
            </>
          )}
          <Link
            href={`mailto:${settings.senderEmail}`}
            style={{ color: colors.text }}
          >
            {settings.senderEmail}
          </Link>
        </Column>
      </Row>
    </Section>
  )
}

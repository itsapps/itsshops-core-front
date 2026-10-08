import * as React from 'react'
import { Column, Link, Row, Section } from '@react-email/components'
import { EmailText } from './EmailText'
import { colors } from '../tokens'
import type { EmailShopSettings, EmailTranslator } from '../types'

/**
 * Email footer — business details (UGB §14 / ECG §5) in every business mail: name, owner,
 * address, phone, email, VAT ID and company register data from `settings.company`; only
 * filled fields are rendered. Falls back to the shop name, billing address and sender email.
 */
export function MailFooter({
  settings,
  locale,
  t,
}: {
  settings: EmailShopSettings
  locale: string
  /** Optional for custom layouts that render the footer without a translator (labels omitted). */
  t?: EmailTranslator
}) {
  const company = settings.company
  const address = company?.address ?? settings.billingAddress
  const email = company?.email || settings.senderEmail
  const countryName = address?.country
    ? new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
    : null
  const label = (key: string, value: string) => (t ? `${t(`emails.footer.${key}`)}: ${value}` : value)
  const register = [
    company?.registerNumber && label('registerNumber', company.registerNumber),
    company?.registerCourt && label('registerCourt', company.registerCourt),
  ].filter(Boolean).join(', ')

  return (
    <Section style={{ marginTop: '48px', padding: '16px 0', borderTop: `1px solid ${colors.divider}` }}>
      <Row>
        <Column align="center">
          <EmailText bold size={18} style={{marginBottom: "8px"}}>
            {company?.name || settings.shopName}
          </EmailText>
          {company?.owner && <EmailText>{label('owner', company.owner)}</EmailText>}
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
          {company?.phone && <EmailText>{label('phone', company.phone)}</EmailText>}
          <Link
            href={`mailto:${email}`}
            style={{ color: colors.text }}
          >
            {email}
          </Link>
          {company?.vatId && <EmailText>{label('vatId', company.vatId)}</EmailText>}
          {register && <EmailText>{register}</EmailText>}
        </Column>
      </Row>
    </Section>
  )
}

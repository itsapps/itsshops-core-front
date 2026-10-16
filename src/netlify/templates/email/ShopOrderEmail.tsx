import * as React from 'react'
import { Column, Link, Row, Section } from '@react-email/components'
import { EmailLayout } from './EmailLayout'
import { EmailText, EmailHeading, EmailButton } from './components'
import { AddressBlock, ItemRow, OrderDetails, TotalsBlock } from './OrderEmail'
import { colors } from './tokens'
import type { ShopOrderEmailProps } from './types'

/**
 * New-order notification for the shop inbox (sent next to the customer's order
 * confirmation). Same order summary, but addressed to the shop: neutral wording,
 * the customer's contact details up front, and none of the customer-only parts
 * (greeting, warranty notice, withdrawal instructions, and the footer with the
 * shop's own company details). Rendered in the shop's default locale
 * (`ctx.locale`), not the customer's.
 */
export function ShopOrderEmail({ ctx, order, studioOrderUrl }: ShopOrderEmailProps) {
  const { t, formatPrice, locale } = ctx
  const { customer, totals, orderItems } = order

  const billed = customer.billingAddress
  const shipped = customer.shippingAddress
  const addressesIdentical =
    JSON.stringify({ ...billed, _type: undefined }) === JSON.stringify({ ...shipped, _type: undefined })
  const phone = billed.phone || shipped.phone
  const customerLanguage = customer.locale
    ? new Intl.DisplayNames([locale], { type: 'language' }).of(customer.locale) ?? customer.locale
    : undefined
  const linkStyle = { color: colors.text, textDecoration: 'underline' }

  return (
    <EmailLayout ctx={ctx} footer={null}>
      <Section style={{ padding: '16px 0' }}>
        <EmailHeading style={{ marginBottom: '12px' }}>
          {t('emails.shopOrderConfirmation.headline', { orderNumber: order.orderNumber })}
        </EmailHeading>
        <EmailText style={{ marginBottom: '8px' }}>{t('emails.shopOrderConfirmation.text')}</EmailText>
        {studioOrderUrl && (
          <Section style={{ paddingTop: '16px' }}>
            <EmailButton href={studioOrderUrl}>{t('emails.shopOrderConfirmation.openInStudio')}</EmailButton>
          </Section>
        )}
      </Section>

      <Section style={{ marginBottom: '32px' }}>
        <EmailText bold style={{ marginBottom: '4px' }}>
          {t('emails.shopOrderConfirmation.customer')}
        </EmailText>
        <EmailText>{billed.name}</EmailText>
        <EmailText>
          <Link href={`mailto:${customer.contactEmail}`} style={linkStyle}>
            {customer.contactEmail}
          </Link>
        </EmailText>
        {phone && (
          <EmailText>
            <Link href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={linkStyle}>
              {phone}
            </Link>
          </EmailText>
        )}
        {customerLanguage && (
          <EmailText>
            {t('emails.shopOrderConfirmation.language')}: {customerLanguage}
          </EmailText>
        )}
      </Section>

      <Section>
        {orderItems.map((item, i) => (
          <ItemRow
            key={item._key}
            item={item}
            formatPrice={formatPrice}
            drawSeparator={i < orderItems.length - 1}
          />
        ))}
      </Section>

      <TotalsBlock totals={totals} ctx={ctx} />

      <OrderDetails ctx={ctx} order={order} />

      <Section style={{ margin: '48px 0 0' }}>
        {addressesIdentical ? (
          <Row>
            <Column>
              <AddressBlock title={t('emails.billedAndShippedTo')} address={billed} locale={locale} />
            </Column>
          </Row>
        ) : (
          <Row>
            <Column style={{ verticalAlign: 'top', paddingRight: '16px' }}>
              <AddressBlock title={t('emails.billedTo')} address={billed} locale={locale} />
            </Column>
            <Column style={{ verticalAlign: 'top' }}>
              <AddressBlock title={t('emails.shippedTo')} address={shipped} locale={locale} />
            </Column>
          </Row>
        )}
      </Section>
    </EmailLayout>
  )
}

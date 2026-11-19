import * as React from 'react'
import { Link, Section } from '@react-email/components'
import { EmailLayout } from './EmailLayout'
import { EmailText, EmailHeading, EmailButton } from './components'
import { AddressesSection, ItemRow, OrderDetails, TotalsBlock } from './OrderEmail'
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
  const { customer, totals, orderItems, fulfillment } = order

  const billed = customer.billingAddress
  const phone = billed.phone || customer.shippingAddress?.phone
  const isPickup = fulfillment.methodType === 'pickup'
  const customerLanguage = customer.locale
    ? new Intl.DisplayNames([locale], { type: 'language' }).of(customer.locale) ?? customer.locale
    : undefined
  const linkStyle = { color: colors.text, textDecoration: 'underline' }

  return (
    <EmailLayout ctx={ctx} footer={null}>
      <Section style={{ padding: '16px 0' }}>
        {/* A pickup order must not be packed for the carrier. */}
        {isPickup && (
          <EmailText bold size={20} style={{ marginBottom: '12px', padding: '8px 12px', border: `2px solid ${colors.text}` }}>
            {t('emails.shopOrderConfirmation.pickupBanner')}
          </EmailText>
        )}
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

      <TotalsBlock totals={totals} ctx={ctx} methodType={fulfillment.methodType} />

      <OrderDetails ctx={ctx} order={order} />

      <AddressesSection ctx={ctx} order={order} style={{ margin: '48px 0 0' }} />
    </EmailLayout>
  )
}

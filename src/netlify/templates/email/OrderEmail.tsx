import * as React from 'react'
import { Column, Row, Section } from '@react-email/components'
import { EmailLayout } from './EmailLayout'
import { EmailText, EmailHeading, EmailHr } from './components'
import type { OrderEmailProps } from './types'
import type { OrderItem, AddressStrict, OrderTotals } from '../../types/checkout'
import { colors } from './tokens'

function AddressBlock({
  title,
  address,
  locale,
}: {
  title: string
  address: AddressStrict
  locale: string
}) {
  const country = new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
  return (
    <>
      <EmailText bold style={{ marginBottom: '4px' }}>
        {title}
      </EmailText>
      <EmailText>{address.name}</EmailText>
      <EmailText>{address.line1}</EmailText>
      {address.line2 && <EmailText>{address.line2}</EmailText>}
      <EmailText>
        {address.zip} {address.city}
      </EmailText>
      <EmailText>{country}</EmailText>
    </>
  )
}

function ItemRow({
  item,
  formatPrice,
  drawSeparator,
}: {
  item: OrderItem
  formatPrice: (cents: number) => string
  drawSeparator: boolean
}) {
  return (
    <>
      <Section>
        <Row>
          <Column>
            <EmailText>{item.quantity}x</EmailText>
            <EmailText bold>{item.title}</EmailText>
            {item.subtitle && <EmailText>{item.subtitle}</EmailText>}
            {item.sku && <EmailText>{`[${item.sku}]`}</EmailText>}
            {item.options?.map((option, i) => (
              <EmailText key={i}>
                {option.groupTitle}: {option.optionTitle}
              </EmailText>
            ))}
          </Column>
          <Column align="right" style={{ verticalAlign: 'bottom' }}>
            <EmailText>{formatPrice(item.price * item.quantity)}</EmailText>
          </Column>
        </Row>
      </Section>
      {drawSeparator && <EmailHr />}
    </>
  )
}

function SummaryLine({
  label,
  value,
  large = false,
}: {
  label: string
  value: string
  large?: boolean
}) {
  const size = large ? 20 : 16
  return (
    <Row style={{ borderBottom: `1px solid ${colors.divider}`, padding: '4px 0' }}>
      <Column align="right">
        <EmailText muted bold align="right" size={size} style={{ paddingRight: '32px' }}>
          {label}
        </EmailText>
      </Column>
      <Column align="right" style={{ width: '160px' }}>
        <EmailText bold align="right" size={size}>
          {value}
        </EmailText>
      </Column>
    </Row>
  )
}

function TotalsBlock({
  totals,
  ctx,
}: {
  totals: OrderTotals
  ctx: OrderEmailProps['ctx']
}) {
  const { t, formatPrice } = ctx
  return (
    <Section style={{ marginTop: '24px' }}>
      <SummaryLine label={t('emails.order.summaryProducts')} value={formatPrice(totals.subtotal)} />
      <SummaryLine label={t('emails.order.summaryShipping')} value={formatPrice(totals.shipping)} />
      {totals.discount > 0 && (
        <SummaryLine label={t('emails.order.summaryDiscount')} value={`-${formatPrice(totals.discount)}`} />
      )}
      <SummaryLine
        label={t('emails.order.summaryTotal')}
        value={formatPrice(totals.grandTotal)}
        large
      />
      <EmailText muted align="right" style={{ marginTop: '4px' }}>
        {t('emails.order.summaryTax', { tax: formatPrice(totals.totalVat) })}
      </EmailText>
    </Section>
  )
}

export function OrderEmail({ ctx, order, mailType }: OrderEmailProps) {
  const { t, formatPrice, locale } = ctx
  const { customer, totals, fulfillment, orderItems } = order

  const billed = customer.billingAddress
  const shipped = customer.shippingAddress
  const addressesIdentical =
    JSON.stringify({ ...billed, _type: undefined }) === JSON.stringify({ ...shipped, _type: undefined })

  const body = t(`emails.${mailType}.text`)
  const headline = t('emails.headline', { customerName: customer.billingAddress.name })

  return (
    <EmailLayout ctx={ctx}>
      <Section style={{ padding: '16px 0' }}>
        <EmailHeading style={{ marginBottom: '12px' }}>{headline}</EmailHeading>
        {body.split('\n').map((line, i) => (
          <EmailText key={i} style={{ marginBottom: '8px' }}>
            {line}
          </EmailText>
        ))}
      </Section>

      <Section style={{margin: "48px 0"}}>
        <Row>
          <Column align="center">
            <EmailText muted>{t('emails.orderNumber')}</EmailText>
            <EmailText bold size={24} style={{margin: "8px 0"}}>{order.orderNumber}</EmailText>
          </Column>
          {/* <Column style={{ verticalAlign: 'top' }}>
            <EmailText muted>{t('emails.invoiceNumber')}</EmailText>
            <EmailText bold>{order.invoiceNumber}</EmailText>
          </Column> */}
        </Row>
      </Section>

      {/* Items */}
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

      {fulfillment.trackingCode && (
        <Section style={{ marginTop: '24px' }}>
          <EmailText>
            {t('emails.trackingNumber')}: <strong>{fulfillment.trackingCode}</strong>
          </EmailText>
        </Section>
      )}

      {/* Addresses */}
      <Section style={{margin: "48px 0"}}>
        {addressesIdentical ? (
          <Row>
            <Column>
              <AddressBlock
                title={t('emails.billedAndShippedTo')}
                address={billed}
                locale={locale}
              />
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

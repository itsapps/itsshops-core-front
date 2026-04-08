import * as React from 'react'
import { Column, Hr, Row, Section, Text } from '@react-email/components'
import { BaseMailTemplate, lineStyle } from './baseMailTemplate'
import type { OrderEmailProps } from './types'
import type { OrderItem, AddressStrict, OrderTotals } from '../types/checkout'

const labelStyle: React.CSSProperties = { ...lineStyle, color: '#888888', fontWeight: 700 }
const valueStyle: React.CSSProperties = { ...lineStyle, fontWeight: 700, textAlign: 'right' as const }

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
      <Text style={{ ...lineStyle, fontWeight: 700, marginBottom: '4px' }}>{title}</Text>
      <Text style={lineStyle}>{address.name}</Text>
      <Text style={lineStyle}>{address.line1}</Text>
      {address.line2 && <Text style={lineStyle}>{address.line2}</Text>}
      <Text style={lineStyle}>
        {address.zip} {address.city}
      </Text>
      <Text style={lineStyle}>{country}</Text>
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
            <Text style={lineStyle}>{item.quantity}x</Text>
            <Text style={{ ...lineStyle, fontWeight: 700 }}>{item.displayTitle}</Text>
            {item.displaySubtitle && <Text style={lineStyle}>{item.displaySubtitle}</Text>}
            {item.sku && <Text style={lineStyle}>{`[${item.sku}]`}</Text>}
            {item.options?.map((option, i) => (
              <Text style={lineStyle} key={i}>
                {option.groupTitle}: {option.optionTitle}
              </Text>
            ))}
          </Column>
          <Column align="right" style={{ verticalAlign: 'bottom' }}>
            <Text style={lineStyle}>{formatPrice(item.price * item.quantity)}</Text>
          </Column>
        </Row>
      </Section>
      {drawSeparator && <Hr style={{ margin: '16px 0', borderColor: '#eeeeee' }} />}
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
  return (
    <>
      <Section>
        <Row>
          <Column align="right">
            <Text style={{ ...labelStyle, paddingRight: '32px', fontSize: large ? '20px' : '14px' }}>
              {label}
            </Text>
          </Column>
          <Column align="right" style={{ width: '160px' }}>
            <Text style={{ ...valueStyle, fontSize: large ? '20px' : '14px' }}>{value}</Text>
          </Column>
        </Row>
      </Section>
      <Hr style={{ margin: 0, borderColor: '#eeeeee' }} />
    </>
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
      <Text style={{ ...lineStyle, color: '#888888', textAlign: 'right' as const, marginTop: '4px' }}>
        {t('emails.order.summaryTax', { tax: formatPrice(totals.totalVat) })}
      </Text>
    </Section>
  )
}

export function OrderMailTemplate({ ctx, order, mailType }: OrderEmailProps) {
  const { t, formatPrice, locale } = ctx
  const { customer, totals, fulfillment, orderItems } = order

  const billed = customer.billingAddress
  const shipped = customer.shippingAddress
  const addressesIdentical =
    JSON.stringify({ ...billed, _type: undefined }) === JSON.stringify({ ...shipped, _type: undefined })

  const body = t(`emails.${mailType}.text`)
  const headline = t('emails.headline', { customerName: customer.billingAddress.name })

  return (
    <BaseMailTemplate ctx={ctx}>
      <Section style={{ padding: '16px 0' }}>
        <Text style={{ ...lineStyle, fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>
          {headline}
        </Text>
        {body.split('\n').map((line, i) => (
          <Text key={i} style={{ ...lineStyle, marginBottom: '8px' }}>
            {line}
          </Text>
        ))}
      </Section>

      <Hr style={{ margin: '16px 0', borderColor: '#eeeeee' }} />

      <Section>
        <Row>
          <Column style={{ verticalAlign: 'top', paddingRight: '16px' }}>
            <Text style={{ ...lineStyle, color: '#888888' }}>{t('emails.orderNumber')}</Text>
            <Text style={{ ...lineStyle, fontWeight: 700 }}>{order.orderNumber}</Text>
          </Column>
          <Column style={{ verticalAlign: 'top' }}>
            <Text style={{ ...lineStyle, color: '#888888' }}>{t('emails.invoiceNumber')}</Text>
            <Text style={{ ...lineStyle, fontWeight: 700 }}>{order.invoiceNumber}</Text>
          </Column>
        </Row>
      </Section>

      <Hr style={{ margin: '16px 0', borderColor: '#eeeeee' }} />

      {/* Addresses */}
      <Section>
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

      <Hr style={{ margin: '16px 0', borderColor: '#eeeeee' }} />

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
          <Text style={lineStyle}>
            {t('emails.trackingNumber')}: <strong>{fulfillment.trackingCode}</strong>
          </Text>
        </Section>
      )}
    </BaseMailTemplate>
  )
}

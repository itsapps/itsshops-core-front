import * as React from 'react'
import { Column, Img, Link, Row, Section } from '@react-email/components'
import { EmailLayout } from './EmailLayout'
import { EmailText, EmailHeading, EmailHr, CustomerMessage } from './components'
import type { OrderEmailProps } from './types'
import type { OrderItem, AddressStrict, OrderTotals, OrderDocument } from '../../types/checkout'
import { colors } from './tokens'
import { paymentMethodLabel } from '../../lib/payment-method'
import { formatShopDate } from '../../utils/i18n'
import { bundleItemLines } from '../../lib/order-item-display'
import type { WithdrawalInstructions, WithdrawalRichText } from '../../../shared/withdrawal-instructions'
import { mailKey, pickupExtraLines } from './mail-keys'

export function AddressBlock({
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
      {address.phone && <EmailText>{address.phone}</EmailText>}
    </>
  )
}

/** The pickup location of a pickup order: shop name, address and instructions. */
export function PickupBlock({
  title,
  shopName,
  fulfillment,
  locale,
}: {
  title: string
  shopName: string
  fulfillment: OrderDocument['fulfillment']
  locale: string
}) {
  const address = fulfillment.pickupAddress
  const country = address
    ? new Intl.DisplayNames([locale], { type: 'region' }).of(address.country) ?? address.country
    : undefined
  return (
    <>
      <EmailText bold style={{ marginBottom: '4px' }}>
        {title}
      </EmailText>
      <EmailText>{shopName}</EmailText>
      {address && (
        <>
          <EmailText>{address.line1}</EmailText>
          {address.line2 && <EmailText>{address.line2}</EmailText>}
          <EmailText>
            {address.zip} {address.city}
          </EmailText>
          <EmailText>{country}</EmailText>
        </>
      )}
      {fulfillment.pickupInstructions?.split('\n').map((line, i) => (
        <EmailText key={i} style={i === 0 ? { marginTop: '8px' } : undefined}>{line}</EmailText>
      ))}
    </>
  )
}

/**
 * The address section: billing + delivery address (one block when equal), or for pickup the
 * billing address + the pickup location.
 */
export function AddressesSection({
  ctx,
  order,
  style,
}: {
  ctx: OrderEmailProps['ctx']
  order: OrderDocument
  style?: React.CSSProperties
}) {
  const { t, locale } = ctx
  const { customer, fulfillment } = order
  const billed = customer.billingAddress
  const shipped = customer.shippingAddress
  const isPickup = fulfillment.methodType === 'pickup'
  const addressesIdentical = !isPickup && (!shipped ||
    JSON.stringify({ ...billed, _type: undefined }) === JSON.stringify({ ...shipped, _type: undefined }))
  return (
    <Section style={style}>
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
            {isPickup || !shipped ? (
              <PickupBlock
                title={t('emails.order.pickupLocation')}
                shopName={ctx.settings.shopName}
                fulfillment={fulfillment}
                locale={locale}
              />
            ) : (
              <AddressBlock title={t('emails.shippedTo')} address={shipped} locale={locale} />
            )}
          </Column>
        </Row>
      )}
    </Section>
  )
}

export function ItemRow({
  item,
  formatPrice,
  drawSeparator,
}: {
  item: OrderItem
  formatPrice: (cents: number) => string
  drawSeparator: boolean
}) {
  // A bundle's contents as a nested list; its subtitle ("2× A, 1× B") would repeat them.
  const contents = bundleItemLines(item)
  return (
    <>
      <Section>
        <Row>
          <Column>
            <EmailText>{item.quantity}x</EmailText>
            <EmailText bold>{item.title}</EmailText>
            {item.subtitle && contents.length === 0 && <EmailText>{item.subtitle}</EmailText>}
            {contents.length > 0 && (
              <ul style={{ margin: '4px 0 0', padding: '0 0 0 20px' }}>
                {contents.map((line, i) => (
                  <li key={i} style={{ fontSize: '14px', lineHeight: '20px' }}>
                    {`${line.quantity} × ${line.title}${line.subtitle ? ` – ${line.subtitle}` : ''}`}
                  </li>
                ))}
              </ul>
            )}
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

/** Order date, payment method and shipping method — part of the contract confirmation (FAGG §4/§7). */
export function OrderDetails({ ctx, order }: Pick<OrderEmailProps, 'ctx' | 'order'>) {
  const { t, locale } = ctx
  const { fulfillment } = order
  // Older orders have no orderDate snapshot → the first status entry (order creation).
  const placedAt = order.orderDate ?? order.statusHistory?.[0]?.timestamp
  const isPickup = fulfillment.methodType === 'pickup'
  const rows: Array<[string, string]> = [
    ...(placedAt ? [[t('emails.order.orderDate'), formatShopDate(placedAt, locale)] as [string, string]] : []),
    ...(order.payment
      ? [[t('emails.order.paymentMethod'), paymentMethodLabel(order.payment, t)] as [string, string]]
      : []),
    ...(fulfillment.methodTitle
      ? [[t(isPickup ? 'emails.order.pickupMethod' : 'emails.order.shippingMethod'), fulfillment.methodTitle] as [string, string]]
      : []),
    ...(fulfillment.deliveryTime
      ? [[t(isPickup ? 'emails.order.pickupReadyTime' : 'emails.order.deliveryTime'), fulfillment.deliveryTime] as [string, string]]
      : []),
  ]
  if (!rows.length) return null
  return (
    <Section style={{ marginTop: '32px' }}>
      {rows.map(([label, value]) => (
        <EmailText key={label}>
          {label}: <strong>{value}</strong>
        </EmailText>
      ))}
    </Section>
  )
}

/** Generated withdrawal instructions + model form — same content as the website module. */
function WithdrawalInstructionsBlock({
  instructions,
  withdrawUrl,
  linkLabel,
}: {
  instructions: WithdrawalInstructions
  withdrawUrl: string
  linkLabel: string
}) {
  const heading = (text: string) => (
    <EmailText bold style={{ marginTop: '16px', marginBottom: '4px' }}>{text}</EmailText>
  )
  const linkStyle = { color: colors.text, textDecoration: 'underline' }
  const paragraph = (content: string | WithdrawalRichText, i: number) => (
    <EmailText key={i} size={14} style={{ marginBottom: '8px' }}>
      {typeof content === 'string'
        ? content
        : content.map((segment, s) =>
            segment.href
              ? <Link key={s} href={segment.href} style={linkStyle}>{segment.text}</Link>
              : <React.Fragment key={s}>{segment.text}</React.Fragment>)}
    </EmailText>
  )
  return (
    <Section style={{ marginTop: '32px' }}>
      <EmailHr />
      {instructions.sections.map((section, s) => (
        <React.Fragment key={s}>
          {heading(section.heading)}
          {section.paragraphs.map(paragraph)}
          {s === 0 && (
            <EmailText style={{ marginBottom: '8px' }}>
              <Link href={withdrawUrl} style={{ color: colors.text, textDecoration: 'underline' }}>
                {linkLabel}
              </Link>
            </EmailText>
          )}
        </React.Fragment>
      ))}
      {heading(instructions.form.heading)}
      {[instructions.form.intro, instructions.form.to, ...instructions.form.lines.map((l) => `– ${l}`), instructions.form.footnote].map(paragraph)}
      {instructions.exceptions && (
        <>
          {heading(instructions.exceptions.heading)}
          {[instructions.exceptions.intro, ...instructions.exceptions.items.map((i) => `– ${i}`)].map(paragraph)}
        </>
      )}
      {instructions.note && (
        <>
          {heading(instructions.note.heading)}
          {instructions.note.text.split('\n').map(paragraph)}
        </>
      )}
    </Section>
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

export function TotalsBlock({
  totals,
  ctx,
  methodType,
}: {
  totals: OrderTotals
  ctx: OrderEmailProps['ctx']
  /** `pickup`: the shipping row reads "Abholung". */
  methodType?: 'delivery' | 'pickup'
}) {
  const { t, formatPrice } = ctx
  return (
    <Section style={{ marginTop: '24px' }}>
      <SummaryLine label={t('emails.order.summaryProducts')} value={formatPrice(totals.subtotal)} />
      <SummaryLine
        label={t(methodType === 'pickup' ? 'emails.order.summaryPickup' : 'emails.order.summaryShipping')}
        value={formatPrice(totals.shipping)}
      />
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

export function OrderEmail({ ctx, order, mailType, customerMessage }: OrderEmailProps) {
  const { t, formatPrice, locale } = ctx
  const { customer, totals, fulfillment, orderItems } = order

  const bodyLines = [
    ...t(mailKey(mailType, order, 'text')).split('\n'),
    ...pickupExtraLines(ctx, mailType, order),
  ]
  const headline = t('emails.headline', { customerName: customer.billingAddress.name })

  return (
    <EmailLayout ctx={ctx}>
      <Section style={{ padding: '16px 0' }}>
        <EmailHeading style={{ marginBottom: '12px' }}>{headline}</EmailHeading>
        {bodyLines.map((line, i) => (
          <EmailText key={i} style={{ marginBottom: '8px' }}>
            {line}
          </EmailText>
        ))}
        <CustomerMessage text={customerMessage} />
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

      <TotalsBlock totals={totals} ctx={ctx} methodType={fulfillment.methodType} />

      <OrderDetails ctx={ctx} order={order} />

      {fulfillment.trackingCode && fulfillment.methodType !== 'pickup' && (
        <Section style={{ marginTop: '24px' }}>
          <EmailText>
            {t('emails.trackingNumber')}: <strong>{fulfillment.trackingCode}</strong>
          </EmailText>
        </Section>
      )}

      {/* Addresses */}
      <AddressesSection ctx={ctx} order={order} style={{ margin: '48px 0' }} />

      {/* Harmonised warranty notice (FAGG §4 (1) + Anhang II) — the official graphic, served by
          the shop site (core ships it at /assets/legal/); confirmation email only. */}
      {mailType === 'orderConfirmation' && ctx.settings.baseUrl && (
        <Section style={{ marginTop: '32px' }}>
          <Link href={t('emails.order.legalGuaranteeUrl')}>
            <Img
              src={`${ctx.settings.baseUrl}/assets/legal/legal-guarantee-notice-${locale === 'de' ? 'de' : 'en'}-1200.png`}
              alt={t('emails.order.legalGuaranteeAlt')}
              width={560}
              style={{ width: '100%', maxWidth: '560px', height: 'auto' }}
            />
          </Link>
        </Section>
      )}

      {/* Right of withdrawal (default on, confirmation email only): the full generated
          instructions + model form (FAGG §7 (3): on a durable medium), or — when settings are
          incomplete — the short notice + link. */}
      {ctx.withdrawUrl && mailType === 'orderConfirmation' && (
        ctx.withdrawalInstructions
          ? <WithdrawalInstructionsBlock instructions={ctx.withdrawalInstructions} withdrawUrl={ctx.withdrawUrl} linkLabel={t('emails.order.withdrawalLink')} />
          : (
            <Section style={{ marginTop: '32px' }}>
              <EmailHr />
              <EmailText bold style={{ marginTop: '16px' }}>
                {t('emails.order.withdrawalTitle')}
              </EmailText>
              <EmailText muted style={{ marginTop: '4px' }}>
                {t('emails.order.withdrawalText')}
              </EmailText>
              <EmailText style={{ marginTop: '8px' }}>
                <Link href={ctx.withdrawUrl} style={{ color: colors.text, textDecoration: 'underline' }}>
                  {t('emails.order.withdrawalLink')}
                </Link>
              </EmailText>
            </Section>
          )
      )}

    </EmailLayout>
  )
}

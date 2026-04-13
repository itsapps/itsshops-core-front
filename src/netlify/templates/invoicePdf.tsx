/**
 * Invoice PDF template using @react-pdf/renderer.
 *
 * Rendered server-side from `/api/order/notify` when a mailType requires an
 * invoice attachment (e.g. `orderInvoice`). Customers can override the entire
 * PDF by passing their own `invoicePdf` component to the notify factory.
 */
import * as React from 'react'
import {
  Document,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { OrderDocument } from '../types/checkout'
import type { EmailContext } from './types'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    padding: 30,
    paddingBottom: 150,
    color: '#000000',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 11 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 11,
    marginVertical: 30,
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  boldLarge: { fontFamily: 'Helvetica-Bold', fontSize: 16 },
  small: { fontSize: 9, color: '#666666' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  invoiceTitle: { fontFamily: 'Helvetica-Bold', fontSize: 18, marginVertical: 16 },
  itemRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '1px solid #cccccc',
    paddingVertical: 4,
  },
  summaryRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottom: '1px solid #000000',
    paddingVertical: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'absolute',
    fontSize: 10,
    bottom: 30,
    left: 30,
    right: 30,
  },
})

export type InvoicePdfProps = {
  ctx: EmailContext
  order: OrderDocument
}

export function InvoicePdf({ ctx, order }: InvoicePdfProps) {
  const { t, formatPrice, locale, settings } = ctx
  const billing = order.customer.billingAddress
  const billingCountry = new Intl.DisplayNames([locale], { type: 'region' }).of(billing.country) ?? billing.country
  const orderDate = new Date(order.statusHistory[0]?.timestamp ?? Date.now())
  const formattedOrderDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(orderDate)

  const showLogo = !!(settings.logoUrl && settings.logoWidth && settings.logoHeight)

  return (
    <Document
      creator={settings.shopName}
      author={settings.shopName}
      title={order.invoiceNumber}
      subject={t('emails.order.invoice')}
    >
      <Page size="A4" style={styles.page}>
        {/* Header — logo (or shop name) + sender block */}
        <View fixed style={styles.header}>
          <Link href={settings.baseUrl}>
            {showLogo ? (
              <Image
                src={settings.logoUrl!}
                style={{
                  width: 150,
                  height: (settings.logoHeight! / settings.logoWidth!) * 150,
                }}
              />
            ) : (
              <Text style={styles.bold}>{settings.shopName}</Text>
            )}
          </Link>
          <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
            <Text style={styles.bold}>{settings.shopName}</Text>
            {settings.billingAddress && (
              <>
                <Text>{settings.billingAddress.line1}</Text>
                {settings.billingAddress.line2 && <Text>{settings.billingAddress.line2}</Text>}
                <Text>
                  {settings.billingAddress.zip} {settings.billingAddress.city}
                </Text>
              </>
            )}
            <Link href={`mailto:${settings.senderEmail}`}>{settings.senderEmail}</Link>
          </View>
        </View>

        {/* Address + meta */}
        <View style={styles.meta}>
          <View style={{ flexDirection: 'column' }}>
            <Text>{billing.name}</Text>
            <Text>{billing.line1}</Text>
            {billing.line2 && <Text>{billing.line2}</Text>}
            <Text>
              {billing.zip} {billing.city}
            </Text>
            <Text>{billingCountry}</Text>
          </View>
          <View style={{ flexDirection: 'column' }}>
            <View style={styles.metaRow}>
              <Text>{t('emails.order.orderDate')}:</Text>
              <Text>{formattedOrderDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text>{t('emails.orderNumber')}:</Text>
              <Text>{order.orderNumber}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text>{t('emails.invoiceNumber')}:</Text>
              <Text>{order.invoiceNumber}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.invoiceTitle}>{t('emails.order.invoice')}</Text>

        {order.orderItems.map((item) => (
          <View key={item._key} style={styles.itemRow}>
            <View style={{ flexDirection: 'column', flex: 1 }}>
              <Text>
                <Text>{item.quantity}x </Text>
                {item.sku ? <Text style={styles.small}>{`[${item.sku}] `}</Text> : null}
                <Text style={styles.bold}>{item.title}</Text>
              </Text>
              {item.subtitle && <Text style={styles.small}>{item.subtitle}</Text>}
              {item.options?.map((option, i) => (
                <Text key={i} style={styles.small}>
                  {option.groupTitle}: {option.optionTitle}
                </Text>
              ))}
            </View>
            <View style={{ alignSelf: 'flex-end' }}>
              <Text>{formatPrice(item.price * item.quantity)}</Text>
            </View>
          </View>
        ))}

        <View style={{ marginTop: 24 }} />

        <View wrap={false}>
          <SummaryLine label={t('emails.order.summaryProducts')} value={formatPrice(order.totals.subtotal)} />
          <SummaryLine
            label={t('emails.order.summaryShipping')}
            subLabel={`(${order.fulfillment.methodTitle})`}
            value={formatPrice(order.totals.shipping)}
          />
          {order.totals.discount > 0 && (
            <SummaryLine
              label={t('emails.order.summaryDiscount')}
              value={`-${formatPrice(order.totals.discount)}`}
            />
          )}
          <SummaryLine
            label={t('emails.order.summaryTotal')}
            value={formatPrice(order.totals.grandTotal)}
            large
          />
          <Text style={{ textAlign: 'right', width: '100%', marginTop: 4 }}>
            {t('emails.order.summaryTax', { tax: formatPrice(order.totals.totalVat) })}
          </Text>
        </View>

        <View fixed style={styles.footer}>
          {settings.bankAccount && (
            <View style={{ flexDirection: 'column', alignItems: 'center' }}>
              <Text style={styles.bold}>{t('emails.order.bankAccount')}</Text>
              <Text>{settings.bankAccount.name}</Text>
              <Text>
                {t('emails.order.iban')}: {settings.bankAccount.iban}
              </Text>
              <Text>
                {t('emails.order.bic')}: {settings.bankAccount.bic}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: 'column', alignItems: 'center' }}>
            <Text style={styles.bold}>{settings.shopName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function SummaryLine({
  label,
  value,
  subLabel,
  large = false,
}: {
  label: string
  value: string
  subLabel?: string
  large?: boolean
}) {
  return (
    <View style={styles.summaryRow}>
      <View style={{ flexDirection: 'column' }}>
        <Text style={[large ? styles.boldLarge : styles.bold, { color: '#666666' }]}>{label}</Text>
        {subLabel && <Text style={{ color: '#666666', fontSize: 9 }}>{subLabel}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            large ? styles.boldLarge : styles.bold,
            { textAlign: 'right', width: '100%' },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

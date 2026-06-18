import * as React from 'react'
import { Column, Img, Link, Row, Section } from '@react-email/components'
import { EmailHeading } from './EmailHeading'
import { colors } from '../tokens'
import type { EmailShopSettings } from '../types'

/**
 * Email header — centered shop logo linking to the storefront, falling back to
 * the shop name as text when no logo is configured.
 */
export function MailHeader({ settings }: { settings: EmailShopSettings }) {
  return (
    <Section style={{ padding: '16px 0' }}>
      <Row>
        <Column align="center">
          <Link href={settings.baseUrl}>
            {settings.logoUrl && settings.logoWidth && settings.logoHeight ? (
              <Img
                src={settings.logoUrl}
                width={150}
                height={(settings.logoHeight / settings.logoWidth) * 150}
                alt={settings.shopName}
                style={{ display: 'block', margin: '0 auto' }}
              />
            ) : (
              <EmailHeading style={{ fontSize: '24px', color: colors.text }}>
                {settings.shopName}
              </EmailHeading>
            )}
          </Link>
        </Column>
      </Row>
    </Section>
  )
}

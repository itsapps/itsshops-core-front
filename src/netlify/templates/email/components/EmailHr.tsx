import * as React from 'react'
import { Hr } from '@react-email/components'
import { colors } from '../tokens'

/**
 * Horizontal divider. Defaults to a 16px vertical margin and the light divider
 * colour; pass `style` to tighten the margin (`margin: 0`) or change the colour.
 */
export function EmailHr({ style, ...props }: React.ComponentProps<typeof Hr>) {
  return <Hr {...props} style={{ margin: '16px 0', borderColor: colors.divider, ...style }} />
}

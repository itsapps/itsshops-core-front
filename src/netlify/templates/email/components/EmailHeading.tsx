import * as React from 'react'
import { Text } from '@react-email/components'

/**
 * Section heading — 20px bold. Pass `style` to override (e.g. a larger logo
 * fallback size in the header).
 */
export function EmailHeading({ style, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      {...props}
      style={{ margin: 0, padding: 0, fontSize: '20px', lineHeight: '26px', fontWeight: 700, ...style }}
    />
  )
}

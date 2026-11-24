import * as React from 'react'
import { Text } from '@react-email/components'
import { colors } from '../tokens'

type EmailTextProps = React.ComponentProps<typeof Text> & {
  /** Bold weight (700). */
  bold?: boolean
  /** Muted grey colour for secondary/label text. */
  muted?: boolean
  /** Horizontal alignment. */
  align?: React.CSSProperties['textAlign']
  /** Font size in px. Defaults to 16. */
  size?: number
}

/**
 * The single body-text primitive for emails. Defaults to 16px / 20px line
 * height; pass `bold`, `muted`, `align`, `size` for the common variants, or
 * `style` for one-off overrides (margins etc.). All explicit `style` wins over
 * the defaults, so call sites and customer overrides stay predictable.
 */
export function EmailText({ bold, muted, align, size, style, ...props }: EmailTextProps) {
  return (
    <Text
      {...props}
      style={{
        margin: 0,
        padding: 0,
        fontSize: `${size ?? 16}px`,
        lineHeight: '20px',
        ...(bold ? { fontWeight: 700 } : null),
        ...(muted ? { color: colors.muted } : null),
        ...(align ? { textAlign: align } : null),
        ...style,
      }}
    />
  )
}

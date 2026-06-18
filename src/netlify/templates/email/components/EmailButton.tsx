import * as React from 'react'
import { Button } from '@react-email/components'
import { colors } from '../tokens'

type EmailButtonProps = React.ComponentProps<typeof Button> & {
  /** Stretch the button to the full width of its container. */
  fullWidth?: boolean
}

/**
 * Call-to-action button. Solid dark pill with white label. Pass `fullWidth` to
 * stretch it across the container, or `style` to override the defaults (e.g. a
 * different background per email).
 */
export function EmailButton({ fullWidth, style, ...props }: EmailButtonProps) {
  return (
    <Button
      {...props}
      style={{
        display: fullWidth ? 'block' : 'inline-block',
        backgroundColor: colors.buttonBackground,
        color: colors.buttonText,
        fontSize: '16px',
        fontWeight: 700,
        padding: '12px 24px',
        borderRadius: '4px',
        textAlign: 'center',
        textDecoration: 'none',
        ...(fullWidth ? { width: '100%', boxSizing: 'border-box' as const } : null),
        ...style,
      }}
    />
  )
}

import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import { staticImage, type PictureSize } from '..'

// A real 600 × 849 PNG from core's assets (read only: statsSync writes nothing).
const file = path.resolve(__dirname, '../../assets/legal/legal-guarantee-notice-de-600.png')

const attr = (html: string, name: string) => Number(html.match(new RegExp(` ${name}="(\\d+)"`))![1])

describe('staticImage width/height', () => {
  it('describe the same image (natural ratio), not the widest width with the smallest height', () => {
    const size: PictureSize = { sizes: [[320, null], [160, null]], widths: '9rem' }
    const html = staticImage(file, size)
    expect(attr(html, 'width')).toBe(320)
    expect(attr(html, 'height')).toBe(452) // 849 × 320 / 600 = 452.8, eleventy-img rounds down
  })

  it('use the source size when the preset is wider than the source', () => {
    const size: PictureSize = { sizes: [[1600, null], [400, null]], widths: '100vw' }
    const html = staticImage(file, size)
    expect(attr(html, 'width')).toBe(600)
    expect(attr(html, 'height')).toBe(849)
  })
})

import { describe, expect, it } from 'vitest'
import { createImageUrlBuilder } from '@sanity/image-url'
import { image, imageSrcsetData, preload, type PictureSize } from '..'
import type { ResolvedImage } from '../../types/data'

const builder = createImageUrlBuilder({ projectId: 'abc12345', dataset: 'test' })

function img(width: number | null, height = 1066, ext = 'jpg'): ResolvedImage {
  const w = width ?? 1599
  return {
    alt: '',
    asset: {
      _ref: `image-abc-${w}x${height}-${ext}`,
      palette: null,
      ...(width ? { dimensions: { width, height, aspectRatio: width / height } } : {}),
    },
  }
}

const srcsetOf = (source: ResolvedImage, size: PictureSize) => imageSrcsetData(builder, source, size)!.srcset
const widthsOf = (srcset: string) => srcset.split(', ').map(c => Number(c.match(/ (\d+)w$/)![1]))
const candidate = (srcset: string, w: number) => srcset.split(', ').find(c => c.endsWith(` ${w}w`))!

const natural: PictureSize = {
  sizes: [[3000, null], [2400, null], [1800, null], [1200, null]],
  widths: '100vw',
}

describe('srcset is capped at the source width', () => {
  it('drops wider entries and offers the source width instead', () => {
    expect(widthsOf(srcsetOf(img(1599), natural))).toEqual([1599, 1200])
  })

  it('leaves the srcset alone when the source is wide enough', () => {
    expect(widthsOf(srcsetOf(img(8000, 5333), natural))).toEqual([3000, 2400, 1800, 1200])
  })

  it('does not duplicate an entry equal to the source width', () => {
    expect(widthsOf(srcsetOf(img(1800, 1200), natural))).toEqual([1800, 1200])
  })

  it('keeps one entry when the source is smaller than every preset width', () => {
    expect(widthsOf(srcsetOf(img(600, 400), natural))).toEqual([600])
  })

  it('keeps every entry for SVGs, whose dimensions are only nominal', () => {
    expect(widthsOf(srcsetOf(img(100, 50, 'svg'), natural))).toEqual([3000, 2400, 1800, 1200])
  })

  it('keeps every entry when dimensions are unknown', () => {
    expect(widthsOf(srcsetOf(img(null), natural))).toEqual([3000, 2400, 1800, 1200])
  })

  it('keeps the preset ratio for fixed-height entries', () => {
    const fixed: PictureSize = { sizes: [[1800, 1200], [800, 533]], widths: '100vw' }
    const srcset = srcsetOf(img(1500, 1000), fixed)
    expect(widthsOf(srcset)).toEqual([1500, 800])
    expect(candidate(srcset, 1500)).toContain('h=1000')
  })

  it('keeps each width paired with its own quality', () => {
    const size: PictureSize = { ...natural, quality: [50, 60, 70, 80] }
    const srcset = srcsetOf(img(1599), size)
    expect(candidate(srcset, 1599)).toContain('q=70')
    expect(candidate(srcset, 1200)).toContain('q=80')
  })

  it('takes source-width quality from the nearest entry when sizes ascend', () => {
    const ascending: PictureSize = { sizes: [[800, null], [1800, null], [3000, null]], widths: '100vw', quality: [40, 50, 60] }
    const srcset = srcsetOf(img(1599), ascending)
    expect(candidate(srcset, 1599)).toContain('q=50')
    expect(candidate(srcset, 800)).toContain('q=40')
  })

  it('gives the preload and the img the identical srcset', () => {
    const source = img(1599)
    const fromPreload = preload(builder, source, natural).match(/imagesrcset="([^"]*)"/)![1]
    const fromImage = image(builder, source, natural).match(/ srcset="([^"]*)"/)![1]
    expect(fromPreload).toBe(fromImage)
    expect(widthsOf(fromImage)).toEqual([1599, 1200])
  })
})

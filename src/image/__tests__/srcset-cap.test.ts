import { describe, expect, it } from 'vitest'
import { createImageUrlBuilder } from '@sanity/image-url'
import { image, imageSrcsetData, preload, type PictureSize } from '..'
import type { ResolvedImage, SanityImageInput } from '../../types/data'

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

const srcsetOf = (source: SanityImageInput, size: PictureSize) => imageSrcsetData(builder, source, size)!.srcset
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

  it('preloads at high priority (the img reuses the preload request)', () => {
    expect(preload(builder, img(1599), natural)).toContain('fetchpriority="high"')
  })

  it('gives the preload and the img the identical srcset', () => {
    const source = img(1599)
    const fromPreload = preload(builder, source, natural).match(/imagesrcset="([^"]*)"/)![1]
    const fromImage = image(builder, source, natural).match(/ srcset="([^"]*)"/)![1]
    expect(fromPreload).toBe(fromImage)
    expect(widthsOf(fromImage)).toEqual([1599, 1200])
  })
})

describe('a raw (unresolved) image', () => {
  it('works with an asset that has `_id` instead of `_ref` (portable-text image blocks)', () => {
    const raw: SanityImageInput = { asset: { _id: 'image-abc-3939x4971-jpg', dimensions: { width: 3939, height: 4971, aspectRatio: 3939 / 4971 } } }
    expect(widthsOf(srcsetOf(raw, natural))).toEqual([3000, 2400, 1800, 1200])
    const svg: SanityImageInput = { asset: { _id: 'image-abc-100x50-svg', dimensions: { width: 100, height: 50, aspectRatio: 2 } } }
    expect(widthsOf(srcsetOf(svg, natural))).toEqual([3000, 2400, 1800, 1200])
  })
})

describe('an editor crop', () => {
  // The terroir background: a 5333×8000 portrait, cropped to the full width × top 48%.
  const portrait = (): ResolvedImage => ({
    ...img(5333, 8000),
    crop: { _type: 'sanity.imageCrop', top: 0, bottom: 0.52, left: 0, right: 0 },
    hotspot: { _type: 'sanity.imageHotspot', x: 0.5, y: 0.25, width: 1, height: 0.48 },
  })

  it('keeps the aspect ratio of the cropped area, not of the whole image', () => {
    const url = candidate(srcsetOf(portrait(), natural), 3000)
    expect(url).toContain('w=3000')
    // 5333 × 3840 → 3000 × 2160 (landscape), not 3000 × 4500
    expect(url).toContain('h=2160')
    expect(url).toContain('rect=0,0,5333,3840')
  })

  it('caps the srcset at the cropped width', () => {
    const cropped: ResolvedImage = { ...img(4000, 3000), crop: { _type: 'sanity.imageCrop', top: 0, bottom: 0, left: 0.25, right: 0.25 } }
    expect(widthsOf(srcsetOf(cropped, natural))).toEqual([2000, 1800, 1200])
  })

  it('ignores the crop for a preset with `fit`, which serves the whole image', () => {
    const gallery: PictureSize = { ...natural, fit: 'max' }
    const url = candidate(srcsetOf(portrait(), gallery), 3000)
    expect(url).not.toContain('rect=')
    expect(url).toContain('h=4500') // whole 5333×8000 image → 3000×4500
    const data = imageSrcsetData(builder, portrait(), gallery)!
    expect(data.height! / data.width).toBeCloseTo(8000 / 5333, 2)
  })

  it('sets the cropped ratio on the img width/height attributes', () => {
    const data = imageSrcsetData(builder, portrait(), natural)!
    expect(data.height! / data.width).toBeCloseTo(3840 / 5333, 2)
  })
})

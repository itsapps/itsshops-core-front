import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ImageUrlBuilder } from '@sanity/image-url'
import type { ResolvedImage } from '../types/data'
import { stegaClean } from '@sanity/client/stega'
import Image from '@11ty/eleventy-img'

const STATIC_URL_PATH = '/assets/images/'
const STATIC_OUTPUT_DIR = './dist/assets/images/'

function normalizeFormats(formats: string[]) {
  return formats.map(f => f === 'jpg' ? 'jpeg' : f)
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PictureSize = {
  /** [width, height] pairs for each srcset entry. Use null height to preserve the image's natural aspect ratio. */
  sizes: [number, number | null][]
  /** CSS sizes attribute value, e.g. "(min-width: 40em) 50vw, 100vw" */
  widths: string
  /** Defaults to ['webp', 'jpg'] */
  formats?: ('webp' | 'jpg' | 'png')[]
  /** Default quality, can be overridden per image (shortcut) */
  quality?: number | (number | null)[]
}

export type PictureOptions = {
  alt?: string
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'low' | 'auto'
  class?: string
  quality?: number | (number | null)[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveHeight(hSpec: number | null, w: number, image: ResolvedImage): number | undefined {
  if (hSpec !== null) return hSpec
  const ar = image.asset.dimensions?.aspectRatio
  return ar ? Math.floor(w / ar) : undefined
}

function resolveQuality(quality: number | (number | null)[] | undefined, index: number): number | undefined {
  if (quality === undefined) return undefined
  const q = Array.isArray(quality) ? quality[index] : quality
  return q ?? undefined
}

function buildSanityUrl(builder: ImageUrlBuilder, image: ResolvedImage, w: number, h: number | null, format?: string, quality?: number): string {
  let b = builder.image(image).width(w)
  if (h !== null) b = b.height(h)
  if (format)    b = b.format(format as any)
  if (quality)   b = b.quality(quality)
  return b.url()
}

// ─── Sanity image ─────────────────────────────────────────────────────────────

function buildSanitySrcset(builder: ImageUrlBuilder, image: ResolvedImage, size: PictureSize, quality?: number | (number | null)[]): string {
  const fmt = (size.formats ?? ['webp'])[0]
  const q = quality ?? size.quality
  return size.sizes.map(([w, hSpec], i) => {
    const h = resolveHeight(hSpec, w, image) ?? null
    return `${buildSanityUrl(builder, image, w, h, fmt, resolveQuality(q, i))} ${w}w`
  }).join(', ')
}

export function preload(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!image) return ''
  
  const { quality } = options
  return `<link rel="preload" as="image" imagesrcset="${buildSanitySrcset(builder, image, size, quality ?? size.quality)}" imagesizes="${size.widths}">`
}

export function image(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!image) return ''

  const fmt = (size.formats ?? ['webp'])[0]
  const alt = stegaClean(options.alt ?? image.alt ?? '').replace(/"/g, '&quot;')
  const { loading = 'lazy', fetchpriority, class: imgClass = '', quality } = options

  const fQuality = quality ?? size.quality
  const srcset = buildSanitySrcset(builder, image, size, fQuality)

  const lastIndex = size.sizes.length - 1
  const [fw, fhSpec] = size.sizes[lastIndex]
  const fh = resolveHeight(fhSpec, fw, image)
  const src = buildSanityUrl(builder, image, fw, fhSpec ?? null, fmt, resolveQuality(fQuality, lastIndex))

  const attrs = [
    `src="${src}"`,
    `srcset="${srcset}"`,
    `sizes="${size.widths}"`,
    `width="${fw}"`,
    fh !== undefined && `height="${fh}"`,
    `alt="${alt}"`,
    `loading="${loading}"`,
    fetchpriority && `fetchpriority="${fetchpriority}"`,
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')

  return `<img ${attrs}>`
}

/** Plain URL for a given size — use for og:image, JSON-LD, CSS backgrounds etc. */
export function imageUrl(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  width?: number,
  height?: number,
  format?: 'webp' | 'jpg',
): string {
  if (!image) return ''
  let b = builder.image(image)
  if (width)  b = b.width(width)
  if (height) b = b.height(height)
  if (format) b = b.format(format as any)
  return b.url()
}

/** Single URL from a PictureSize preset — uses the smallest [w, h] entry */
export function imageSizeUrl(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  size: PictureSize,
  format?: 'webp' | 'jpg',
): string {
  if (!image) return ''
  const [w, h] = size.sizes[size.sizes.length - 1]
  return imageUrl(builder, image, w, h ?? undefined, format)
}

// ─── Static image ─────────────────────────────────────────────────────────────

/** Uses statsSync (no file writes). Files are pre-generated by preGenerateStaticImages(). */
export function staticImage(
  src: string,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!src) return ''

  const formats = normalizeFormats(size.formats ?? ['webp']) as any[]
  const widths = size.sizes.map(([w]) => w)
  const metadata = Image.statsSync(src, { widths, formats, urlPath: STATIC_URL_PATH, outputDir: STATIC_OUTPUT_DIR })

  return buildStaticPictureHtml(metadata, size, options)
}

export function staticPreload(src: string, size: PictureSize): string {
  if (!src) return ''
  const formats = normalizeFormats(size.formats ?? ['webp']) as any[]
  const widths = size.sizes.map(([w]) => w)
  const metadata = Image.statsSync(src, { widths, formats, urlPath: STATIC_URL_PATH, outputDir: STATIC_OUTPUT_DIR })
  const primaryFormat = (Object.values(metadata) as any[][])[0]
  const srcset = primaryFormat.map((entry: any) => `${entry.url} ${entry.width}w`).join(', ')
  return `<link rel="preload" as="image" imagesrcset="${srcset}" imagesizes="${size.widths}">`
}

/** Pre-generates all static images so statsSync URLs resolve to real files. */
export async function preGenerateStaticImages(staticDir: string, imageSizes: Record<string, PictureSize>) {
  if (!fs.existsSync(staticDir)) return
  const allWidths = [...new Set(Object.values(imageSizes).flatMap(s => s.sizes.map(([w]) => w)))]
  const allFormats = [...new Set(Object.values(imageSizes).flatMap(s => normalizeFormats(s.formats ?? ['webp'])))] as any[]
  for (const file of collectImageFiles(staticDir)) {
    await Image(file, {
      widths: allWidths,
      formats: allFormats,
      outputDir: path.resolve(STATIC_OUTPUT_DIR),
      urlPath: STATIC_URL_PATH,
    })
  }
}

function collectImageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectImageFiles(full)
    return /\.(png|jpe?g|gif|webp)$/i.test(entry.name) ? [full] : []
  })
}

function buildStaticPictureHtml(
  metadata: any,
  size: PictureSize,
  options: PictureOptions,
): string {
  const alt = (options.alt ?? '').replace(/"/g, '&quot;')
  const { loading = 'lazy', fetchpriority, class: imgClass = '' } = options

  const primaryFormat = (Object.values(metadata) as any[][])[0]
  const srcset = primaryFormat.map((entry: any) => `${entry.url} ${entry.width}w`).join(', ')
  const [fw, fhSpec] = size.sizes[0]
  const fh = fhSpec ?? primaryFormat[0].height
  const src = primaryFormat[primaryFormat.length - 1].url

  const attrs = [
    `src="${src}"`,
    `srcset="${srcset}"`,
    `sizes="${size.widths}"`,
    `width="${fw}"`,
    fh !== undefined && `height="${fh}"`,
    `alt="${alt}"`,
    `loading="${loading}"`,
    fetchpriority && `fetchpriority="${fetchpriority}"`,
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')

  return `<img ${attrs}>`
}

// ─── Presets ──────────────────────────────────────────────────────────────────

/**
 * Core image size presets. Extended per project via `imageSizes` in itsshops.config.mts.
 * Usage: {% image image, imageSizes.hero, { loading: "eager" } %}
 *        {% staticImage "logo.png", imageSizes.logo %}
 */
export const imageSizes = {
  /** Full-width hero, 16:9 */
  hero: {
    sizes: [[1800, 1100], [1600, 900], [1200, 675]] as [number, number][],
    widths: '(min-width: 80rem) 1600px, (min-width: 60rem) 1200px, 100vw',
  },
  /** Main content image, 4:3 */
  content: {
    sizes: [[800, 600], [400, 300]] as [number, number][],
    widths: '(min-width: 50rem) 800px, 100vw',
  },
  /** Full-width carousel slide, 3:2 */
  carousel: {
    sizes: [[1200, 800], [800, 533]] as [number, number][],
    widths: '(min-width: 60rem) 1200px, 100vw',
  },
  /** Grid card image, 3:2 */
  card: {
    sizes: [[600, 400], [300, 200]] as [number, number][],
    widths: '(min-width: 30rem) 50vw, 100vw',
  },
  /** Small square thumbnail, 1:1 */
  thumb: {
    sizes: [[300, 300]] as [number, number][],
    widths: '300px',
  },
  /** Single product page image — half viewport on desktop */
  product: {
    sizes: [[1200, null], [800, null]] as [number, null][],
    widths: '(min-width: 60rem) 50vw, 100vw',
  },
  /** Cart sidebar item thumbnail, 1:1 square */
  cart: {
    sizes: [[80, 80]] as [number, number][],
    widths: '80px',
  },
} satisfies Record<string, PictureSize>

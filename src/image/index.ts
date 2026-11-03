import * as fs from 'node:fs'
import * as path from 'node:path'
import type { ImageUrlBuilder } from '@sanity/image-url'
import type { SanityImageInput } from '../types/data'
import { stegaClean } from '@sanity/client/stega'
import Image from '@11ty/eleventy-img'

const STATIC_URL_PATH = '/assets/images/'
const STATIC_OUTPUT_DIR = './dist/assets/images/'

function normalizeFormat(format: string) {
  return format === 'jpg' ? 'jpeg' : format
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PictureSize = {
  /** [width, height] pairs for each srcset entry. Use null height to preserve the image's natural aspect ratio. */
  sizes: [number, number | null][]
  /** CSS sizes attribute value, e.g. "(min-width: 40em) 50vw, 100vw" */
  widths: string
  /** Defaults to 'webp' */
  format?: 'webp' | 'jpg' | 'png'
  /** Default quality, can be overridden per image (shortcut) */
  quality?: number | (number | null)[]
  /** Sanity fit mode. 'max' fits within w×h without cropping. Default is Sanity's default ('crop' when both w+h are set). */
  fit?: 'crop' | 'max' | 'clip' | 'fill' | 'min' | 'scale'
}

export type PictureOptions = {
  alt?: string
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'low' | 'auto'
  class?: string
  quality?: number | (number | null)[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pixel size of what Sanity serves before resizing: the asset dimensions minus the editor crop
 * (Sanity stores it as fractions cut off each side). A preset with `fit` serves the whole image
 * (`ignoreImageParams()` in buildSanityUrl drops crop + hotspot), so the crop is ignored there.
 */
function sourceDimensions(image: SanityImageInput, fit: PictureSize['fit']): { width: number; height: number } | undefined {
  const d = image.asset.dimensions
  if (!d) return undefined
  const c = fit ? undefined : image.crop
  const width = d.width * (1 - (c?.left ?? 0) - (c?.right ?? 0))
  const height = d.height * (1 - (c?.top ?? 0) - (c?.bottom ?? 0))
  return width > 0 && height > 0 ? { width, height } : { width: d.width, height: d.height }
}

/**
 * A `null` height keeps the natural aspect ratio — of the *cropped* image (whole image with `fit`). Using the uncropped
 * ratio would send both w and h, and Sanity would then cut that ratio out of the crop around the
 * hotspot (e.g. a landscape crop of a portrait photo came back portrait).
 */
function resolveHeight(hSpec: number | null, w: number, image: SanityImageInput, fit: PictureSize['fit']): number | undefined {
  if (hSpec !== null) return hSpec
  const d = sourceDimensions(image, fit)
  if (!d) return undefined
  // Same arithmetic as before the crop fix (w / aspectRatio), so uncropped images keep their
  // exact URLs (w * h / w would round some heights 1px differently).
  const ratio = d.width === image.asset.dimensions!.width && d.height === image.asset.dimensions!.height
    ? image.asset.dimensions!.aspectRatio
    : d.width / d.height
  return Math.floor(w / ratio)
}

function resolveQuality(quality: number | (number | null)[] | undefined, index: number): number | undefined {
  if (quality === undefined) return undefined
  const q = Array.isArray(quality) ? quality[index] : quality
  return q ?? undefined
}

function buildSanityUrl(builder: ImageUrlBuilder, image: SanityImageInput, w: number, h: number | null, format?: string, quality?: number, fit?: PictureSize['fit']): string {
  let b = builder.image(image)
  if (fit) b = b.ignoreImageParams()
  b = b.width(w)
  if (h !== null) b = b.height(h)
  if (fit)       b = b.fit(fit)
  if (format)    b = b.format(format as any)
  if (quality)   b = b.quality(quality)
  return b.url()
}

// ─── Sanity image ─────────────────────────────────────────────────────────────

type SrcsetEntry = { w: number; hSpec: number | null; quality: number | undefined }

/**
 * Sanity upscales on request, so widths above the source (the cropped width, if cropped) add bytes
 * but no detail. Drops them and offers the source width instead, keeping the ratio and quality of the nearest dropped entry.
 * SVGs (nominal dimensions only) and images without known dimensions keep every entry.
 */
function capToSourceWidth(image: SanityImageInput, entries: SrcsetEntry[], fit: PictureSize['fit']): SrcsetEntry[] {
  const cropped = sourceDimensions(image, fit)?.width
  const sourceWidth = cropped ? Math.floor(cropped) : undefined
  // Resolved images carry `_ref`; raw ones (e.g. portable-text image blocks rendered straight from
  // the query, `asset->{ _id, … }`) only `_id`.
  const ref = image.asset._ref ?? image.asset._id ?? ''
  if (!sourceWidth || ref.endsWith('-svg')) return entries

  const kept = entries.filter(e => e.w <= sourceWidth)
  const dropped = entries.filter(e => e.w > sourceWidth)
  if (!dropped.length || kept.some(e => e.w === sourceWidth)) return kept

  const nearest = dropped.reduce((a, b) => (b.w < a.w ? b : a))
  const hSpec = nearest.hSpec === null ? null : Math.round(nearest.hSpec * sourceWidth / nearest.w)
  return [{ w: sourceWidth, hSpec, quality: nearest.quality }, ...kept]
}

function buildSanitySrcset(builder: ImageUrlBuilder, image: SanityImageInput, size: PictureSize, quality?: number | (number | null)[]): string {
  const fmt = size.format ?? 'webp'
  const q = quality ?? size.quality
  const entries = size.sizes.map(([w, hSpec], i) => ({ w, hSpec, quality: resolveQuality(q, i) }))
  return capToSourceWidth(image, entries, size.fit).map(({ w, hSpec, quality: entryQuality }) => {
    const h = resolveHeight(hSpec, w, image, size.fit) ?? null
    return `${buildSanityUrl(builder, image, w, h, fmt, entryQuality, size.fit)} ${w}w`
  }).join(', ')
}

export function preload(
  builder: ImageUrlBuilder,
  image: SanityImageInput | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!image) return ''
  
  const { quality } = options
  // fetchpriority: the <img> reuses this request, so its own fetchpriority="high" never applies —
  // without it the preload runs at Low and loses to lazy images near the viewport.
  return `<link rel="preload" as="image" fetchpriority="high" imagesrcset="${buildSanitySrcset(builder, image, size, quality ?? size.quality)}" imagesizes="${size.widths}">`
}

export function image(
  builder: ImageUrlBuilder,
  image: SanityImageInput | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!image) return ''

  const fmt = size.format ?? 'webp'
  const alt = stegaClean(options.alt ?? image.alt ?? '').replace(/"/g, '&quot;')
  const { loading = 'lazy', fetchpriority, class: imgClass = '', quality } = options

  const fQuality = quality ?? size.quality
  const srcset = buildSanitySrcset(builder, image, size, fQuality)

  const lastIndex = size.sizes.length - 1
  const [fw, fhSpec] = size.sizes[lastIndex]
  const fh = resolveHeight(fhSpec, fw, image, size.fit)
  const src = buildSanityUrl(builder, image, fw, fhSpec ?? null, fmt, resolveQuality(fQuality, lastIndex), size.fit)

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

/**
 * Build srcset/src data for use in search index entries.
 * Returns null when image is absent or the size has no entries.
 * Store the result in the search entry JSON; the runtime renderer builds the <img> tag from it.
 */
export function imageSrcsetData(
  builder: ImageUrlBuilder,
  image: SanityImageInput | null | undefined,
  size: PictureSize,
): { src: string; srcset: string; sizes: string; width: number; height: number | undefined } | null {
  if (!image || !size.sizes.length) return null
  const fmt = size.format ?? 'webp'
  const lastIndex = size.sizes.length - 1
  const [fw, fhSpec] = size.sizes[lastIndex]
  const fh = resolveHeight(fhSpec, fw, image, size.fit)
  const src = buildSanityUrl(builder, image, fw, fhSpec ?? null, fmt, resolveQuality(size.quality, lastIndex), size.fit)
  const srcset = buildSanitySrcset(builder, image, size, size.quality)
  return { src, srcset, sizes: size.widths, width: fw, height: fh }
}

/** Plain URL for a given size — use for og:image, JSON-LD, CSS backgrounds etc. */
export function imageUrl(
  builder: ImageUrlBuilder,
  image: SanityImageInput | null | undefined,
  width?: number,
  height?: number,
  format?: 'webp' | 'jpg',
  fit?: PictureSize['fit'],
  bg?: string,
): string {
  if (!image) return ''
  let b = builder.image(image)
  if (fit)    b = b.ignoreImageParams()
  if (width)  b = b.width(width)
  if (height) b = b.height(height)
  if (fit)    b = b.fit(fit)
  if (bg)     b = b.bg(bg)
  if (format) b = b.format(format as any)
  return b.url()
}

/**
 * Fill the `{{width}}`/`{{height}}` placeholders in a Vinofact resize URL.
 * The Vinofact API returns image URLs like
 * `https://i.vinofact.com/resize/{{width}}x{{height}}/wine_imgs/x.jpeg`,
 * leaving the dimensions to the consumer so each site downloads the size it needs.
 * Call once per size to build a srcset. Returns '' for a missing url.
 */
export function vinofactImageUrl(url: string | null | undefined, width: number, height: number): string {
  if (!url) return ''
  return url
    .replace(/\{\{\s*width\s*\}\}/g, String(Math.round(width)))
    .replace(/\{\{\s*height\s*\}\}/g, String(Math.round(height)))
}

/** Minimal shape of a resolved Vinofact image. width/height are optional — the API
 *  may not expose them yet; when present they drive aspect-ratio-aware heights. */
export type VinofactImageData = {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
}

/**
 * Resolve each PictureSize entry to a concrete [width, height] for Vinofact.
 * The resize proxy needs both dimensions (no auto mode), so a `null` height is
 * filled from the image's aspect ratio when width/height are known, otherwise it
 * falls back to a square. Explicit heights in the preset always win.
 */
function vinofactSizes(size: PictureSize, image: VinofactImageData): [number, number][] {
  const ratio = image.width && image.height ? image.width / image.height : null
  return size.sizes.map(([w, h]) => [w, h ?? (ratio ? Math.round(w / ratio) : w)])
}

/**
 * Build responsive-image data for a Vinofact image, mirroring imageSrcsetData.
 * Takes the resolved image object + a PictureSize preset (same presets as the
 * Sanity `image` shortcode). `src` falls back to the largest candidate.
 *
 * Usage (template):
 *   {% set b = wine.bottleImage | vinofactSrcset(imageSizes.bottle) %}
 *   <img src="{{ b.src }}" srcset="{{ b.srcset }}" sizes="{{ b.sizes }}" width="{{ b.width }}" height="{{ b.height }}">
 */
export function vinofactSrcset(
  image: VinofactImageData | null | undefined,
  size: PictureSize,
): { src: string; srcset: string; sizes: string; width: number; height: number } | null {
  const url = image?.url
  if (!url || !size.sizes.length) return null
  const pairs = vinofactSizes(size, image)
  const srcset = pairs.map(([w, h]) => `${vinofactImageUrl(url, w, h)} ${Math.round(w)}w`).join(', ')
  const [lw, lh] = pairs.reduce((max, s) => (s[0] > max[0] ? s : max), pairs[0])
  return { src: vinofactImageUrl(url, lw, lh), srcset, sizes: size.widths, width: Math.round(lw), height: Math.round(lh) }
}

/**
 * Render a complete responsive `<img>` for a Vinofact image — the Vinofact
 * counterpart to the `image()` Sanity shortcode. Same call shape: the resolved
 * image object, a PictureSize preset, and the usual options. `alt` defaults to
 * the image's own alt.
 *
 * Usage (template):
 *   {% vinofactImage cert.image, imageSizes.certLogo, { class: "cert-logo" } %}
 */
export function vinofactImage(
  image: VinofactImageData | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  const data = vinofactSrcset(image, size)
  if (!data) return ''

  const { loading = 'lazy', fetchpriority, class: imgClass = '', alt } = options
  const altClean = stegaClean(alt ?? image?.alt ?? '').replace(/"/g, '&quot;')

  const attrs = [
    `src="${data.src}"`,
    `srcset="${data.srcset}"`,
    data.sizes && `sizes="${data.sizes}"`,
    `width="${data.width}"`,
    `height="${data.height}"`,
    `alt="${altClean}"`,
    `loading="${loading}"`,
    fetchpriority && `fetchpriority="${fetchpriority}"`,
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')

  return `<img ${attrs}>`
}

/** Single URL from a PictureSize preset — uses the largest [w, h] entry for retina sharpness */
export function imageSizeUrl(
  builder: ImageUrlBuilder,
  image: SanityImageInput | null | undefined,
  size: PictureSize,
  format?: 'webp' | 'jpg',
): string {
  if (!image) return ''
  const [w, h] = size.sizes[0]
  return imageUrl(builder, image, w, h ?? undefined, format, size.fit)
}

// ─── Static image ─────────────────────────────────────────────────────────────

/** Uses statsSync (no file writes). Files are pre-generated by preGenerateStaticImages(). */
export function staticImage(
  src: string,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!src) return ''

  const formats = [normalizeFormat(size.format ?? 'webp')] as any[]
  const widths = size.sizes.map(([w]) => w)
  const metadata = Image.statsSync(src, { widths, formats, urlPath: STATIC_URL_PATH, outputDir: STATIC_OUTPUT_DIR })

  return buildStaticPictureHtml(metadata, size, options)
}

export function staticPreload(src: string, size: PictureSize): string {
  if (!src) return ''
  const formats = [normalizeFormat(size.format ?? 'webp')] as any[]
  const widths = size.sizes.map(([w]) => w)
  const metadata = Image.statsSync(src, { widths, formats, urlPath: STATIC_URL_PATH, outputDir: STATIC_OUTPUT_DIR })
  const primaryFormat = (Object.values(metadata) as any[][])[0]
  const srcset = primaryFormat.map((entry: any) => `${entry.url} ${entry.width}w`).join(', ')
  return `<link rel="preload" as="image" fetchpriority="high" imagesrcset="${srcset}" imagesizes="${size.widths}">`
}

/** Pre-generates all static images so statsSync URLs resolve to real files. */
export async function preGenerateStaticImages(staticDir: string, imageSizes: Record<string, PictureSize>) {
  if (!fs.existsSync(staticDir)) return
  const allWidths = [...new Set(Object.values(imageSizes).flatMap(s => s.sizes.map(([w]) => w)))]
  const allFormats = [...new Set(Object.values(imageSizes).map(s => normalizeFormat(s.format ?? 'webp')))] as any[]
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

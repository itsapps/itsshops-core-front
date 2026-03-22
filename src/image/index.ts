import type { ImageUrlBuilder } from '@sanity/image-url'
import type { ResolvedImage } from '../types/data'
import { stegaClean } from '@sanity/client/stega'
import Image from '@11ty/eleventy-img'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PictureSize = {
  /** [width, height] pairs for each srcset entry. Use null height to preserve the image's natural aspect ratio. */
  sizes: [number, number | null][]
  /** CSS sizes attribute value, e.g. "(min-width: 40em) 50vw, 100vw" */
  widths: string
  /** Defaults to ['webp', 'jpg'] */
  formats?: ('webp' | 'jpg')[]
}

export type PictureOptions = {
  alt?: string
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'low' | 'auto'
  class?: string
  pictureClass?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveHeight(hSpec: number | null, w: number, image: ResolvedImage): number | undefined {
  if (hSpec !== null) return hSpec
  const ar = image.asset.dimensions?.aspectRatio
  return ar ? Math.floor(w / ar) : undefined
}

function buildSanityUrl(builder: ImageUrlBuilder, image: ResolvedImage, w: number, h: number | null, format?: string): string {
  let b = builder.image(image).width(w)
  if (h !== null) b = b.height(h)
  if (image.crop)    b = b.crop('focalpoint')
  if (image.hotspot) b = b.focalPoint(image.hotspot.x ?? 0.5, image.hotspot.y ?? 0.5)
  if (format)        b = b.format(format as any)
  return b.url()
}

function buildPictureHtml(
  sources: string[],
  fallbackUrl: string,
  fw: number,
  fh: number | undefined,
  alt: string,
  options: PictureOptions,
): string {
  const { loading = 'lazy', fetchpriority, class: imgClass = '', pictureClass = '' } = options
  const imgAttrs = [
    `src="${fallbackUrl}"`,
    `width="${fw}"`,
    fh !== undefined && `height="${fh}"`,
    `alt="${alt}"`,
    `loading="${loading}"`,
    fetchpriority && `fetchpriority="${fetchpriority}"`,
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')
  const pictureAttrs = pictureClass ? ` class="${pictureClass}"` : ''
  return `<picture${pictureAttrs}>\n  ${sources.join('\n  ')}\n  <img ${imgAttrs}>\n</picture>`
}

// ─── Sanity image ─────────────────────────────────────────────────────────────

export function sanityPicture(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  size: PictureSize,
  options: PictureOptions = {},
): string {
  if (!image) return ''

  const fmt = (size.formats ?? ['webp'])[0]
  const alt = stegaClean(options.alt ?? image.alt ?? '').replace(/"/g, '&quot;')
  const { loading = 'lazy', fetchpriority, class: imgClass = '' } = options

  const srcset = size.sizes.map(([w, hSpec]) => {
    const h = resolveHeight(hSpec, w, image) ?? null
    return `${buildSanityUrl(builder, image, w, h, fmt)} ${w}w`
  }).join(', ')

  const [fw, fhSpec] = size.sizes[size.sizes.length - 1]
  const fh = resolveHeight(fhSpec, fw, image)
  const src = buildSanityUrl(builder, image, fw, fhSpec ?? null, fmt)

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
  if (width)         b = b.width(width)
  if (height)        b = b.height(height)
  if (format)        b = b.format(format as any)
  if (image.crop)    b = b.crop('focalpoint')
  if (image.hotspot) b = b.focalPoint(image.hotspot.x ?? 0.5, image.hotspot.y ?? 0.5)
  return b.url()
}

// ─── Static image ─────────────────────────────────────────────────────────────

export async function staticPicture(
  src: string,
  size: PictureSize,
  options: PictureOptions = {},
  isPreview = false,
): Promise<string> {
  if (!src) return ''

  const formats = (size.formats ?? ['webp']).map(f => f === 'jpg' ? 'jpeg' : f)
  const widths = size.sizes.map(([w]) => w)

  const imageOptions = { widths, formats, urlPath: '/assets/images/', outputDir: './dist/assets/images/' }

  const metadata = isPreview
    ? Image.statsSync(src, imageOptions)
    : await Image(src, imageOptions)

  const alt = (options.alt ?? '').replace(/"/g, '&quot;')
  const formatEntries = Object.values(metadata) as any[][]

  const sources = formatEntries.map(imageFormat => {
    const type = imageFormat[0].sourceType
    const srcset = imageFormat.map(entry => `${entry.url} ${entry.width}w`).join(', ')
    return `<source type="${type}" srcset="${srcset}" sizes="${size.widths}">`
  })

  const primaryFormat = formatEntries[0]
  const [fw, fhSpec] = size.sizes[0]
  const fh = fhSpec ?? primaryFormat[0].height
  const fallbackEntry = primaryFormat[primaryFormat.length - 1]

  return buildPictureHtml(sources, fallbackEntry.url, fw, fh, alt, options)
}

// ─── Presets ──────────────────────────────────────────────────────────────────

/**
 * Core image size presets. Extended per project via `imageSizes` in project.config.mts.
 * Usage: {% sanityPicture image, imageSizes.hero, { loading: "eager" } %}
 *        {% staticPicture "./src/assets/images/logo.png", imageSizes.logo %}
 */
export const imageSizes = {
  /** Full-width hero, 16:9 */
  hero: {
    sizes: [[1600, 900], [1200, 675], [800, 450]] as [number, number][],
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
} satisfies Record<string, PictureSize>

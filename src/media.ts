import type { ImageUrlBuilder } from '@sanity/image-url'
import type { ResolvedImage } from './types/data'
import { stegaClean } from '@sanity/client/stega'

export type PictureSize = {
  /** [width, height] pairs for each srcset entry */
  sizes: [number, number][]
  /** CSS sizes attribute value, e.g. "(min-width: 40em) 50vw, 100vw" */
  widths: string
  /** Defaults to ['webp', 'jpg'] */
  formats?: ('webp' | 'jpg')[]
}

type PictureOptions = {
  alt?: string
  loading?: 'lazy' | 'eager'
  fetchpriority?: 'high' | 'low' | 'auto'
  class?: string
  pictureClass?: string
}

function buildUrl(builder: ImageUrlBuilder, image: ResolvedImage, w: number, h: number, format?: string): string {
  let b = builder.image(image).width(w).height(h)
  if (image.crop)    b = b.crop('focalpoint')
  if (image.hotspot) b = b.focalPoint(image.hotspot.x ?? 0.5, image.hotspot.y ?? 0.5)
  if (format)        b = b.format(format as any)
  return b.url()
}

export function sanityPicture(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  size: PictureSize,
  options: PictureOptions = {}
): string {
  if (!image) return ''

  const formats = size.formats ?? ['webp', 'jpg']
  const { loading = 'lazy', fetchpriority, class: imgClass = '', pictureClass = '', alt: altOverride } = options
  const alt = stegaClean(altOverride ?? image.alt ?? '').replace(/"/g, '&quot;')

  const sources = formats.map(fmt => {
    const type = fmt === 'webp' ? 'image/webp' : 'image/jpeg'
    const srcset = size.sizes.map(([w, h]) => `${buildUrl(builder, image, w, h, fmt)} ${w}w`).join(', ')
    return `<source type="${type}" srcset="${srcset}" sizes="${size.widths}">`
  })

  const [fw, fh] = size.sizes[0]
  const fallback = buildUrl(builder, image, fw, fh)
  const imgAttrs = [
    `src="${fallback}"`,
    `width="${fw}"`,
    `height="${fh}"`,
    `alt="${alt}"`,
    `loading="${loading}"`,
    fetchpriority && `fetchpriority="${fetchpriority}"`,
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')

  const pictureAttrs = pictureClass ? ` class="${pictureClass}"` : ''
  return `<picture${pictureAttrs}>\n  ${sources.join('\n  ')}\n  <img ${imgAttrs}>\n</picture>`
}

/**
 * Common image size presets for use with the `sanityPicture` shortcode.
 * Use as: {% sanityPicture image, imageSizes.hero, { loading: "eager" } %}
 */
export const imageSizes = {
  /** Full-width hero, 16:9 */
  hero: {
    sizes: [[1600, 900], [1200, 675], [800, 450]] as [number, number][],
    widths: '(min-width: 80rem) 1600px, (min-width: 60rem) 1200px, 100vw',
  },
  /** Main content image, 4:3 — product detail, category header */
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

/** Plain URL for a given size — use for og:image, JSON-LD, etc. */
export function imageUrl(
  builder: ImageUrlBuilder,
  image: ResolvedImage | null | undefined,
  width?: number,
  height?: number
): string {
  if (!image) return ''
  let b = builder.image(image)
  if (width)         b = b.width(width)
  if (height)        b = b.height(height)
  if (image.crop)    b = b.crop('focalpoint')
  if (image.hotspot) b = b.focalPoint(image.hotspot.x ?? 0.5, image.hotspot.y ?? 0.5)
  return b.url()
}

import type { ImageUrlBuilder } from '@sanity/image-url'
import type { ResolvedImage } from './types/data'

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
  const { loading = 'lazy', class: imgClass = '', pictureClass = '', alt: altOverride } = options
  const alt = (altOverride ?? image.alt ?? '').replace(/"/g, '&quot;')

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
    imgClass && `class="${imgClass}"`,
  ].filter(Boolean).join(' ')

  const pictureAttrs = pictureClass ? ` class="${pictureClass}"` : ''
  return `<picture${pictureAttrs}>\n  ${sources.join('\n  ')}\n  <img ${imgAttrs}>\n</picture>`
}

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

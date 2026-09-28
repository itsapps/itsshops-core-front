import { image as renderImg, imageSrcsetData, imageUrl, type PictureSize } from '../image'
import { slugify } from '../data/slugify'

export type GalleryOptions = {
  /** Field on each item holding the image; omit if items ARE images. */
  imageKey?: string
  /** Field on each item holding the caption text. */
  captionKey?: string
  /** Prepended to the caption when present (e.g. "Photo:"). */
  captionPrefix?: string
  /** Field on each item to use for the download filename base (e.g. "title"). Falls back to alt. */
  nameKey?: string
  /** Prepended to the download filename (e.g. the group headline). */
  namePrefix?: string
  /** Offer a per-image download link in the viewer. */
  download?: boolean
  downloadExt?: 'jpg' | 'png' | 'webp'
  downloadWidth?: number
  /** How to render the opener: a button (label), the image itself, or nothing. */
  trigger?: 'button' | 'image' | 'none'
  /** Button label (defaults to the localized "View gallery"). */
  label?: string
  /** Size for the 'image' trigger thumbnail (defaults to `size`). */
  thumbSize?: PictureSize
  /** Base CSS class (default "gallery"). */
  class?: string
}

/** Localized labels for the viewer chrome (set as data-attributes, read by the script). */
export type GalleryChrome = { view: string; close: string; prev: string; next: string; download: string; dialog: string }

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render a lightbox gallery: a `[data-lightbox]` container holding the images as
 * a JSON blob + an opener. Clicking the opener loads the viewer (Embla) on demand.
 * Works for one image (nav auto-hidden) or many.
 */
export function renderGallery(
  builder: any,
  images: any[],
  size: PictureSize,
  options: GalleryOptions = {},
  chrome: GalleryChrome,
): string {
  const {
    imageKey,
    captionKey,
    captionPrefix = '',
    nameKey,
    namePrefix,
    download = false,
    downloadExt,
    downloadWidth,
    trigger = 'button',
    label = chrome.view,
    thumbSize,
    class: cls = 'gallery',
  } = options

  const items = (images ?? [])
    .map((el: any) => {
      const img = imageKey ? el?.[imageKey] : el
      const data = imageSrcsetData(builder, img, size)
      if (!data) return null
      const alt = (img?.alt ?? '') as string
      const rawCaption = captionKey ? (el?.[captionKey] ?? '') : ''
      const caption = rawCaption ? `${captionPrefix}${rawCaption}` : ''
      let dl = ''
      if (download) {
        // default: the original file (no resize/reformat). Pass downloadWidth or
        // downloadExt to force a transformed variant instead.
        const base =
          downloadWidth != null || downloadExt != null
            ? imageUrl(builder, img, downloadWidth, undefined, downloadExt as 'jpg' | 'webp')
            : imageUrl(builder, img)
        if (base) {
          const nameBase = (nameKey ? el?.[nameKey] : '') || alt || 'image'
          const name =
            [namePrefix, nameBase].filter(Boolean).map((s) => slugify(String(s))).filter(Boolean).join('-') ||
            'download'
          const ext = downloadExt ?? (base.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? '')
          dl = `${base}${base.includes('?') ? '&' : '?'}dl=${name}${ext ? `.${ext}` : ''}`
        }
      }
      return { ...data, alt, caption, download: dl }
    })
    .filter(Boolean)

  if (!items.length) return ''

  // safe to embed in <script type="application/json">
  const json = JSON.stringify(items).replace(/</g, '\\u003c')

  let triggerHtml = ''
  if (trigger === 'button') {
    triggerHtml = `<button type="button" class="${cls}__trigger" data-gallery-open aria-haspopup="dialog">${esc(label)}</button>`
  } else if (trigger === 'image') {
    const firstImg = imageKey ? images[0]?.[imageKey] : images[0]
    const thumb = renderImg(builder, firstImg, thumbSize ?? size, { alt: firstImg?.alt ?? '' })
    triggerHtml = `<button type="button" class="${cls}__trigger ${cls}__trigger--image" data-gallery-open aria-haspopup="dialog" aria-label="${esc(label)}">${thumb}</button>`
  }

  return (
    `<div class="${cls}" data-lightbox` +
    ` data-label-dialog="${esc(chrome.dialog)}"` +
    ` data-label-close="${esc(chrome.close)}"` +
    ` data-label-prev="${esc(chrome.prev)}"` +
    ` data-label-next="${esc(chrome.next)}"` +
    ` data-label-download="${esc(chrome.download)}">` +
    triggerHtml +
    `<script type="application/json" data-lightbox-items>${json}</script>` +
    `</div>`
  )
}

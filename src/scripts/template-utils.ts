/**
 * Clone a <template> by ID and return the root element.
 * Returns null if the template doesn't exist.
 */
export function cloneTemplate(templateId: string): HTMLElement | null {
  const template = document.getElementById(templateId) as HTMLTemplateElement | null
  if (!template) return null
  const fragment = template.content.cloneNode(true) as DocumentFragment
  return fragment.firstElementChild as HTMLElement | null
}

/**
 * Fill a slot element inside a cloned template.
 * Slots are identified by data-slot="name" attributes.
 */
export function fillSlot(root: HTMLElement, name: string, text: string): void {
  const el = root.querySelector<HTMLElement>(`[data-slot="${name}"]`)
  if (el) {
    el.textContent = text
    el.hidden = false
  }
}

/**
 * Fill an image slot: set src and show, or hide if no URL.
 */
export function fillImageSlot(root: HTMLElement, name: string, url: string, width?: number, height?: number): void {
  const el = root.querySelector<HTMLImageElement>(`[data-slot="${name}"]`)
  if (!el) return
  if (url) {
    el.src = url
    if (width) el.width = width
    if (height) el.height = height
    el.hidden = false
  } else {
    el.hidden = true
  }
}

/**
 * Fill a link slot: set href and text.
 */
export function fillLinkSlot(root: HTMLElement, name: string, text: string, href: string): void {
  const el = root.querySelector<HTMLAnchorElement>(`[data-slot="${name}"]`)
  if (el) {
    el.textContent = text
    el.href = href
    el.hidden = false
  }
}

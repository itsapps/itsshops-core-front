import { hasCartChanges, type CartChanges } from './cart-store'

export type ChangeLabels = {
  intro: string
  /** Placeholders: `{title}` */
  removed: string
  /** `{title}`, `{from}`, `{to}` */
  price: string
  /** `{title}`, `{quantity}` */
  quantity: string
  /** `{title}`, `{contents}` */
  contents: string
  reconfirm: string
}

/**
 * Whether a payment must not be confirmed: the cart changed, or the total differs from the one
 * the customer last saw (`null` — nothing seen yet — counts as differing).
 */
export function mustReconfirm(changes: CartChanges, shownGrandTotal: number | null, newGrandTotal: number): boolean {
  return hasCartChanges(changes) || shownGrandTotal === null || shownGrandTotal !== newGrandTotal
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => values[key] ?? m)
}

/** One sentence per change, item titles from the stored cart. */
export function changeMessages(changes: CartChanges, labels: ChangeLabels, formatPrice: (cents: number) => string): string[] {
  return [
    ...changes.removed.map(item => fill(labels.removed, { title: item.title })),
    ...changes.price.map(c => fill(labels.price, { title: c.item.title, from: formatPrice(c.from), to: formatPrice(c.to) })),
    ...changes.quantity.map(c => fill(labels.quantity, { title: c.item.title, quantity: String(c.to) })),
    ...changes.contents.map(item => fill(labels.contents, { title: item.title, contents: item.subtitle ?? '' })),
  ]
}

/**
 * Fill the notice region (`[data-checkout-changes]`, `role="status"`) by replacing its children:
 * intro + one `<li>` per change (+ the re-confirm request). Nothing to report → emptied.
 */
export function renderChanges(
  el: HTMLElement,
  changes: CartChanges,
  labels: ChangeLabels,
  formatPrice: (cents: number) => string,
  { reconfirm = false } = {},
): void {
  const messages = changeMessages(changes, labels, formatPrice)
  if (messages.length === 0 && !reconfirm) {
    el.replaceChildren()
    return
  }
  const nodes: Node[] = []
  if (messages.length) {
    const intro = document.createElement('p')
    intro.textContent = labels.intro
    const list = document.createElement('ul')
    for (const message of messages) {
      const li = document.createElement('li')
      li.textContent = message
      list.appendChild(li)
    }
    nodes.push(intro, list)
  }
  if (reconfirm) {
    const p = document.createElement('p')
    p.textContent = labels.reconfirm
    nodes.push(p)
  }
  el.replaceChildren(...nodes)
}

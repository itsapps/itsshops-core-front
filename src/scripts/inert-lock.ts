type InertLock = { release: () => void }
type InertLockOptions = {
  /**
   * Also inert the siblings of every ancestor of the kept elements, not just other children of
   * <body>. Needed when a kept element lives deep inside the page (e.g. a panel inside <main>).
   */
  deep?: boolean
}

export function lockInertOutside(keep: HTMLElement[], options: InertLockOptions = {}): InertLock {
  const keepAncestors = new Set<HTMLElement>()
  for (const el of keep) {
    let n: HTMLElement | null = el
    while (n && n !== document.body) {
      keepAncestors.add(n)
      n = n.parentElement
    }
  }

  const inerted: HTMLElement[] = []
  const inertChildrenOf = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (!(child instanceof HTMLElement)) continue
      if (keepAncestors.has(child)) {
        if (options.deep && !keep.includes(child)) inertChildrenOf(child)
        continue
      }
      if (child.hasAttribute('inert')) continue
      child.setAttribute('inert', '')
      inerted.push(child)
    }
  }
  inertChildrenOf(document.body)

  return {
    release: () => {
      for (const el of inerted) el.removeAttribute('inert')
    },
  }
}

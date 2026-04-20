type InertLock = { release: () => void }

export function lockInertOutside(keep: HTMLElement[]): InertLock {
  const keepAncestors = new Set<HTMLElement>()
  for (const el of keep) {
    let n: HTMLElement | null = el
    while (n && n !== document.body) {
      keepAncestors.add(n)
      n = n.parentElement
    }
  }

  const inerted: HTMLElement[] = []
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement)) continue
    if (keepAncestors.has(child)) continue
    if (child.hasAttribute('inert')) continue
    child.setAttribute('inert', '')
    inerted.push(child)
  }

  return {
    release: () => {
      for (const el of inerted) el.removeAttribute('inert')
    },
  }
}

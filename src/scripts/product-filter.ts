/**
 * URL-based product filter.
 *
 * Reads active filters from URL search params, toggles `data-filter-item`
 * elements based on `data-filter-attrs` JSON, and syncs button states.
 *
 * URL format: ?vintage=2021&groesse=s&groesse=m
 * Multiple values for the same key are AND-ed per group, groups are AND-ed.
 *
 * Data attributes:
 *   [data-product-list]        — container (one or more on the page)
 *   [data-product-filters]     — filter bar
 *   [data-filter-item]         — each product wrapper
 *   [data-filter-attrs]        — JSON string: Record<string, string[]>
 *   [data-filter-key]          — on filter buttons: group key
 *   [data-filter-value]        — on filter buttons: value slug
 *   [data-filter-reset]        — reset button
 */

type FilterState = Map<string, Set<string>>

function parseFilterState(): FilterState {
  const state: FilterState = new Map()
  const params = new URLSearchParams(location.search)
  params.forEach((value, key) => {
    if (!state.has(key)) state.set(key, new Set())
    state.get(key)!.add(value)
  })
  return state
}

function stateToSearch(state: FilterState): string {
  const params = new URLSearchParams()
  state.forEach((values, key) => {
    values.forEach(v => params.append(key, v))
  })
  const s = params.toString()
  return s ? `?${s}` : location.pathname
}

function itemMatchesState(attrs: Record<string, string[]>, state: FilterState): boolean {
  for (const [key, activeValues] of state) {
    const itemValues = attrs[key] ?? []
    // Item must have at least one of the active values for this group
    const hasMatch = [...activeValues].some(v => itemValues.includes(v))
    if (!hasMatch) return false
  }
  return true
}

function applyState(state: FilterState): void {
  // Update items
  document.querySelectorAll<HTMLElement>('[data-filter-item]').forEach(item => {
    let attrs: Record<string, string[]> = {}
    try { attrs = JSON.parse(item.dataset.filterAttrs ?? '{}') } catch (_) { /* noop */ }
    const visible = state.size === 0 || itemMatchesState(attrs, state)
    item.hidden = !visible
  })

  // Update button states
  document.querySelectorAll<HTMLButtonElement>('[data-filter-key]').forEach(btn => {
    const key = btn.dataset.filterKey!
    const value = btn.dataset.filterValue!
    const active = state.get(key)?.has(value) ?? false
    btn.setAttribute('aria-pressed', String(active))
    btn.classList.toggle('is-active', active)
  })

  // Update reset visibility
  document.querySelectorAll<HTMLElement>('[data-filter-reset]').forEach(btn => {
    btn.hidden = state.size === 0
  })
}

function toggleFilter(key: string, value: string): void {
  const state = parseFilterState()
  if (!state.has(key)) state.set(key, new Set())
  const set = state.get(key)!
  if (set.has(value)) {
    set.delete(value)
    if (set.size === 0) state.delete(key)
  } else {
    set.add(value)
  }
  history.pushState(null, '', stateToSearch(state))
  applyState(state)
}

function resetFilters(): void {
  history.pushState(null, '', location.pathname)
  applyState(new Map())
}

export function initProductFilter(): void {
  if (!document.querySelector('[data-product-list]')) return

  // Initial apply from URL
  applyState(parseFilterState())

  // Filter button clicks
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-filter-key]')
    if (btn) {
      toggleFilter(btn.dataset.filterKey!, btn.dataset.filterValue!)
      return
    }
    const reset = (e.target as Element).closest('[data-filter-reset]')
    if (reset) resetFilters()
  })

  // Handle browser back/forward
  window.addEventListener('popstate', () => applyState(parseFilterState()))
}

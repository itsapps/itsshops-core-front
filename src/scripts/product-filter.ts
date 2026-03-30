/**
 * URL-based product filter.
 *
 * Reads active filters from URL search params, toggles `data-filter-item`
 * elements based on `data-filter-attrs` JSON, and syncs checkbox states.
 *
 * URL format: ?vintage=2021&groesse=s&groesse=m
 * Multiple values for the same key are OR-ed per group, groups are AND-ed.
 *
 * Data attributes:
 *   [data-product-list]        — container (one or more on the page)
 *   [data-product-filters]     — filter bar; carries data-t-results for live region
 *   [data-filter-item]         — each product wrapper
 *   [data-filter-attrs]        — JSON string: Record<string, string[]>
 *   input[data-filter-key]     — checkbox inputs: group key
 *   input[data-filter-value]   — checkbox inputs: value slug
 *   [data-filter-reset]        — reset button
 *   [data-filter-count]        — sr-only live region for result count
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
    const hasMatch = [...activeValues].some(v => itemValues.includes(v))
    if (!hasMatch) return false
  }
  return true
}

function applyState(state: FilterState): void {
  // Update items
  let visibleCount = 0
  document.querySelectorAll<HTMLElement>('[data-filter-item]').forEach(item => {
    let attrs: Record<string, string[]> = {}
    try { attrs = JSON.parse(item.dataset.filterAttrs ?? '{}') } catch (_) { /* noop */ }
    const visible = state.size === 0 || itemMatchesState(attrs, state)
    item.hidden = !visible
    if (visible) visibleCount++
  })

  // Sync checkbox states
  document.querySelectorAll<HTMLInputElement>('input[data-filter-key]').forEach(input => {
    input.checked = state.get(input.dataset.filterKey!)?.has(input.dataset.filterValue!) ?? false
  })

  // Update reset button visibility
  document.querySelectorAll<HTMLElement>('[data-filter-reset]').forEach(btn => {
    btn.hidden = state.size === 0
  })

  // Announce result count to screen readers
  document.querySelectorAll<HTMLElement>('[data-filter-count]').forEach(el => {
    if (state.size === 0) {
      el.textContent = ''
      return
    }
    const template = el.closest<HTMLElement>('[data-product-filters]')?.dataset.tResults ?? '{{count}}'
    el.textContent = template.replace('{count}', String(visibleCount))
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

function syncViewButton(view: string): void {
  document.querySelectorAll<HTMLElement>('[data-toggle-products-view]').forEach(btn => {
    const label = view === 'grid' ? btn.dataset.labelList : btn.dataset.labelGrid
    if (label) btn.textContent = label
  })
}

export function initProductFilter(): void {
  if (!document.querySelector('[data-product-list]')) return

  applyState(parseFilterState())

  const productList = document.querySelector<HTMLElement>('[data-product-list]')
  if (productList) syncViewButton(productList.dataset.view ?? 'grid')

  // Checkbox filter changes
  document.addEventListener('change', (e) => {
    const input = (e.target as Element).closest<HTMLInputElement>('input[data-filter-key]')
    if (input) toggleFilter(input.dataset.filterKey!, input.dataset.filterValue!)
  })

  // Reset + view/filter panel toggles
  document.addEventListener('click', (e) => {
    const target = e.target as Element

    if (target.closest('[data-toggle-products-filter]')) {
      document.querySelector('[data-filter-panel]')?.classList.toggle('is-open')
      return
    }

    if (target.closest('[data-toggle-products-view]') && productList) {
      const next = productList.dataset.view === 'grid' ? 'list' : 'grid'
      productList.dataset.view = next
      syncViewButton(next)
      return
    }

    if (target.closest('[data-filter-reset]')) resetFilters()
  })

  window.addEventListener('popstate', () => applyState(parseFilterState()))
}

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
 *   [data-filter-price]        — price in cents (on each item, for price range filter)
 *   input[data-filter-price-min] — min price input (whole currency units)
 *   input[data-filter-price-max] — max price input (whole currency units)
 *   [data-filter-reset]        — reset button
 *   [data-filter-count]        — sr-only live region for result count
 */

type FilterState = {
  attrs: Map<string, Set<string>>
  priceMin: number | null
  priceMax: number | null
}

function parseFilterState(): FilterState {
  const attrs: FilterState['attrs'] = new Map()
  const params = new URLSearchParams(location.search)
  let priceMin: number | null = null
  let priceMax: number | null = null
  params.forEach((value, key) => {
    if (key === 'priceMin') { priceMin = Number(value) || null; return }
    if (key === 'priceMax') { priceMax = Number(value) || null; return }
    if (!attrs.has(key)) attrs.set(key, new Set())
    attrs.get(key)!.add(value)
  })
  return { attrs, priceMin, priceMax }
}

function stateToSearch(state: FilterState): string {
  const params = new URLSearchParams()
  state.attrs.forEach((values, key) => {
    values.forEach(v => params.append(key, v))
  })
  if (state.priceMin !== null) params.set('priceMin', String(state.priceMin))
  if (state.priceMax !== null) params.set('priceMax', String(state.priceMax))
  const s = params.toString()
  return s ? `?${s}` : location.pathname
}

function itemMatchesState(attrs: Record<string, string[]>, state: FilterState['attrs']): boolean {
  for (const [key, activeValues] of state) {
    const itemValues = attrs[key] ?? []
    const hasMatch = [...activeValues].some(v => itemValues.includes(v))
    if (!hasMatch) return false
  }
  return true
}

function isStateEmpty(state: FilterState): boolean {
  return state.attrs.size === 0 && state.priceMin === null && state.priceMax === null
}

function isCollapsedState(state: FilterState, collapseOnlyKeys: Set<string>): boolean {
  if (state.priceMin !== null || state.priceMax !== null) return false
  for (const key of state.attrs.keys()) {
    if (!collapseOnlyKeys.has(key)) return false
  }
  return true
}

function itemMatchesPrice(priceCents: number | null, state: FilterState): boolean {
  if (priceCents === null) return true
  // Price inputs are in whole currency units (euros), data-filter-price is in cents
  if (state.priceMin !== null && priceCents < state.priceMin * 100) return false
  if (state.priceMax !== null && priceCents > state.priceMax * 100) return false
  return true
}

function applyState(state: FilterState): void {
  // Update items
  let visibleCount = 0
  document.querySelectorAll<HTMLElement>('[data-filter-item]').forEach(item => {
    let attrs: Record<string, string[]> = {}
    try { attrs = JSON.parse(item.dataset.filterAttrs ?? '{}') } catch (_) { /* noop */ }
    const price = item.dataset.filterPrice ? Number(item.dataset.filterPrice) : null
    const visible = isStateEmpty(state)
      || (itemMatchesState(attrs, state.attrs) && itemMatchesPrice(price, state))
    item.hidden = !visible
    if (visible) visibleCount++
  })

  // Collapse-by-product: optional grouping — one card per product when only passive filters active
  document.querySelectorAll<HTMLElement>('[data-product-list]').forEach(list => {
    if (!list.hasAttribute('data-collapse-by-product')) return
    const collapseOnlyKeys = new Set(
      (list.dataset.collapseOnlyKeys ?? '').split(',').map(s => s.trim()).filter(Boolean),
    )
    const collapsed = isCollapsedState(state, collapseOnlyKeys)
    if (collapsed) {
      list.setAttribute('data-filter-collapsed', '')
      const seen = new Set<string>()
      list.querySelectorAll<HTMLElement>('[data-filter-item]').forEach(item => {
        if (item.hidden) return
        const ref = item.dataset.productRef
        if (!ref) return
        if (seen.has(ref)) { item.hidden = true; visibleCount-- }
        else seen.add(ref)
      })
    } else {
      list.removeAttribute('data-filter-collapsed')
    }
  })

  // Sync checkbox states
  document.querySelectorAll<HTMLInputElement>('input[data-filter-key]').forEach(input => {
    input.checked = state.attrs.get(input.dataset.filterKey!)?.has(input.dataset.filterValue!) ?? false
  })

  // Sync price inputs + sliders
  const priceMinInput = document.querySelector<HTMLInputElement>('input[data-filter-price-min]')
  const priceMaxInput = document.querySelector<HTMLInputElement>('input[data-filter-price-max]')
  const priceSliderMin = document.querySelector<HTMLInputElement>('input[data-filter-price-slider-min]')
  const priceSliderMax = document.querySelector<HTMLInputElement>('input[data-filter-price-slider-max]')
  if (priceMinInput) priceMinInput.value = state.priceMin !== null ? String(state.priceMin) : ''
  if (priceMaxInput) priceMaxInput.value = state.priceMax !== null ? String(state.priceMax) : ''
  if (priceSliderMin) priceSliderMin.value = state.priceMin !== null ? String(state.priceMin) : priceSliderMin.min
  if (priceSliderMax) priceSliderMax.value = state.priceMax !== null ? String(state.priceMax) : priceSliderMax.max

  // Update reset button visibility
  const empty = isStateEmpty(state)
  document.querySelectorAll<HTMLElement>('[data-filter-reset]').forEach(btn => {
    btn.hidden = empty
  })

  // Update active-filter count badge on toggle button
  const activeCount = state.attrs.size + (state.priceMin !== null || state.priceMax !== null ? 1 : 0)
  document.querySelectorAll<HTMLElement>('[data-filter-active-count]').forEach(el => {
    el.textContent = activeCount > 0 ? String(activeCount) : ''
    el.hidden = activeCount === 0
  })

  // Announce result count to screen readers
  document.querySelectorAll<HTMLElement>('[data-filter-count]').forEach(el => {
    if (empty) {
      el.textContent = ''
      return
    }
    const template = el.closest<HTMLElement>('[data-product-filters]')?.dataset.tResults ?? '{{count}}'
    el.textContent = template.replace('{count}', String(visibleCount))
  })
}

function toggleFilter(key: string, value: string): void {
  const state = parseFilterState()
  if (!state.attrs.has(key)) state.attrs.set(key, new Set())
  const set = state.attrs.get(key)!
  if (set.has(value)) {
    set.delete(value)
    if (set.size === 0) state.attrs.delete(key)
  } else {
    set.add(value)
  }
  history.pushState(null, '', stateToSearch(state))
  applyState(state)
}

function syncPriceSliderToInput(slider: HTMLInputElement, input: HTMLInputElement): void {
  input.value = slider.value
}

function syncPriceInputToSlider(input: HTMLInputElement, slider: HTMLInputElement): void {
  if (input.value) slider.value = input.value
}

function readPriceState(): { priceMin: number | null; priceMax: number | null } {
  const minInput = document.querySelector<HTMLInputElement>('input[data-filter-price-min]')
  const maxInput = document.querySelector<HTMLInputElement>('input[data-filter-price-max]')
  return {
    priceMin: minInput?.value ? Number(minInput.value) : null,
    priceMax: maxInput?.value ? Number(maxInput.value) : null,
  }
}

function updatePriceFilter(): void {
  const state = parseFilterState()
  const { priceMin, priceMax } = readPriceState()
  state.priceMin = priceMin
  state.priceMax = priceMax
  history.pushState(null, '', stateToSearch(state))
  applyState(state)
}

function resetFilters(): void {
  history.pushState(null, '', location.pathname)
  applyState({ attrs: new Map(), priceMin: null, priceMax: null })
}

function syncViewButton(view: string): void {
  document.querySelectorAll<HTMLElement>('[data-toggle-products-view]').forEach(btn => {
    const label = view === 'grid' ? btn.dataset.labelList : btn.dataset.labelGrid
    if (label) {
      btn.textContent = label
      btn.setAttribute('aria-label', label)
    }
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
    if (input) {
      toggleFilter(input.dataset.filterKey!, input.dataset.filterValue!)
      // Collapse the group's <details> when a value was just checked
      if (input.checked) {
        input.closest<HTMLDetailsElement>('details.product-filters__group')?.removeAttribute('open')
      }
    }
  })

  // Price range inputs + sliders
  const priceMinInput = document.querySelector<HTMLInputElement>('input[data-filter-price-min]')
  const priceMaxInput = document.querySelector<HTMLInputElement>('input[data-filter-price-max]')
  const priceSliderMin = document.querySelector<HTMLInputElement>('input[data-filter-price-slider-min]')
  const priceSliderMax = document.querySelector<HTMLInputElement>('input[data-filter-price-slider-max]')

  priceMinInput?.addEventListener('input', () => {
    if (priceSliderMin) syncPriceInputToSlider(priceMinInput, priceSliderMin)
    updatePriceFilter()
  })
  priceMaxInput?.addEventListener('input', () => {
    if (priceSliderMax) syncPriceInputToSlider(priceMaxInput, priceSliderMax)
    updatePriceFilter()
  })
  priceSliderMin?.addEventListener('input', () => {
    if (priceMinInput) syncPriceSliderToInput(priceSliderMin, priceMinInput)
    // Prevent min exceeding max
    if (priceSliderMax && Number(priceSliderMin.value) > Number(priceSliderMax.value)) {
      priceSliderMax.value = priceSliderMin.value
      if (priceMaxInput) syncPriceSliderToInput(priceSliderMax, priceMaxInput)
    }
    updatePriceFilter()
  })
  priceSliderMax?.addEventListener('input', () => {
    if (priceMaxInput) syncPriceSliderToInput(priceSliderMax, priceMaxInput)
    // Prevent max going below min
    if (priceSliderMin && Number(priceSliderMax.value) < Number(priceSliderMin.value)) {
      priceSliderMin.value = priceSliderMax.value
      if (priceMinInput) syncPriceSliderToInput(priceSliderMin, priceMinInput)
    }
    updatePriceFilter()
  })

  // Reset + view/filter panel toggles
  document.addEventListener('click', (e) => {
    const target = e.target as Element

    if (target.closest('[data-toggle-products-filter]')) {
      const panel = document.querySelector('[data-filter-panel]')
      panel?.classList.toggle('is-open')
      const isOpen = panel?.classList.contains('is-open') ?? false
      const btn = target.closest<HTMLElement>('[data-toggle-products-filter]')
      btn?.setAttribute('aria-expanded', String(isOpen))
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

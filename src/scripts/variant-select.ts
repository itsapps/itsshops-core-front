/**
 * Variant selector navigation.
 *
 * Powers the dropdowns rendered by the `productVariantSelector` macro: each
 * <option>'s value is the target variant's URL (precomputed in the resolver,
 * incl. nearest-fallback), so switching is a plain navigation. List-mode axes
 * use <a> links and need no JS.
 */
export function initVariantSelect(): void {
  document.querySelectorAll<HTMLSelectElement>('[data-variant-select]').forEach((select) => {
    select.addEventListener('change', () => {
      if (select.value) window.location.href = select.value
    })
  })
}

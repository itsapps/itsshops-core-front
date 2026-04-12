import MiniSearch from 'minisearch'
import type { SearchItem } from '../types/data'

type SearchResult = SearchItem & { score: number }

let miniSearch: MiniSearch | null = null
let indexUrl: string | null = null
let searchFields: string[] = ['title']
let currency = 'EUR'
let currencyLabel: string | undefined

async function loadIndex(): Promise<void> {
  if (miniSearch || !indexUrl) return
  const res = await fetch(indexUrl)
  if (!res.ok) throw new Error(`Failed to load search index: ${res.status}`)
  const entries: SearchItem[] = await res.json()
  miniSearch = new MiniSearch({
    idField: 'id',
    fields: searchFields,
    storeFields: Object.keys(entries[0] ?? {}),
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 2 },
    },
  })
  miniSearch.addAll(entries)
}

function formatPrice(cents: number): string {
  const locale = document.documentElement.lang || undefined
  if (currencyLabel) {
    const n = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
    return `${n} ${currencyLabel}`
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

function renderImage(result: SearchResult): string {
  const img = result.image
  if (!img) return ''
  return `<img
    src="${img.src}"
    srcset="${img.srcset}"
    sizes="${img.sizes}"
    width="${img.width}"
    ${img.height != null ? `height="${img.height}"` : ''}
    loading="lazy"
    alt=""
    class="search-results__image"
  >`
}

function defaultRender(results: SearchResult[], container: HTMLElement): void {
  const list = document.createElement('ul')
  list.className = 'search-results__list'
  for (const result of results) {
    const li = document.createElement('li')
    li.className = 'search-results__item'
    li.innerHTML = `
      <a href="${result.slug}" class="search-results__link">
        ${result.image ? `<span class="search-results__image-wrap">${renderImage(result)}</span>` : ''}
        <span class="search-results__body">
          <span class="search-results__title">${result.title}</span>
          ${result.subtitle ? `<span class="search-results__subtitle">${result.subtitle}</span>` : ''}
        </span>
        ${result.price != null ? `<span class="search-results__price">${formatPrice(result.price)}</span>` : ''}
      </a>
    `
    li.querySelector('a')!.addEventListener('click', () => {
      saveRecent({
        slug: result.slug,
        title: result.title,
        subtitle: result.subtitle,
        price: result.price,
        image: result.image,
      })
    })
    list.appendChild(li)
  }
  container.innerHTML = ''
  container.appendChild(list)
}

function renderResults(results: SearchResult[], container: HTMLElement): void {
  if (results.length === 0) {
    container.innerHTML = ''
    container.dispatchEvent(new CustomEvent('search:empty', { bubbles: true }))
    return
  }

  // Dispatch cancelable event — customer calls e.preventDefault() to skip default rendering
  const event = new CustomEvent<SearchResult[]>('search:results', {
    bubbles: true,
    cancelable: true,
    detail: results,
  })
  container.dispatchEvent(event)

  if (!event.defaultPrevented) {
    defaultRender(results, container)
  }
}

// ── Recent results ───────────────────────────────────────────────────────

const RECENT_KEY = 'itsshops-search-recent'
const RECENT_MAX = 5

type RecentEntry = Pick<SearchItem, 'slug' | 'title' | 'subtitle' | 'price' | 'image'>

function getRecent(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  } catch { return [] }
}

function saveRecent(entry: RecentEntry): void {
  const recent = getRecent().filter(r => r.slug !== entry.slug)
  recent.unshift(entry)
  if (recent.length > RECENT_MAX) recent.length = RECENT_MAX
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)) } catch {}
}

function showRecent(container: HTMLElement): void {
  const recent = getRecent()
  if (!recent.length) return
  defaultRender(recent as SearchResult[], container)
}

// ── Utils ────────────────────────────────────────────────────────────────

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export function init(): void {
  const modal = document.querySelector<HTMLElement>('[data-search-modal]')
  const container = document.querySelector<HTMLElement>('[data-search]')
  if (!container) return

  const input = container.querySelector<HTMLInputElement>('[data-search-input]')!
  const results = container.querySelector<HTMLElement>('[data-search-results]')!
  if (!input || !results) return

  indexUrl = input.dataset.searchIndexUrl ?? null
  searchFields = JSON.parse(input.dataset.searchFields ?? '["title"]')
  currency = input.dataset.currency || 'EUR'
  currencyLabel = input.dataset.currencyLabel || undefined

  // ── Modal open/close ──────────────────────────────────────────────────────

  function openModal(): void {
    if (!modal) return
    modal.hidden = false
    document.body.style.overflow = 'hidden'
    input.focus()
    if (!input.value.trim()) showRecent(results)
  }

  function closeModal(): void {
    if (!modal) return
    modal.hidden = true
    document.body.style.overflow = ''
    input.value = ''
    results.innerHTML = ''
  }

  document.querySelectorAll('[data-search-open]').forEach(btn => {
    btn.addEventListener('click', openModal)
  })

  document.querySelectorAll('[data-search-close]').forEach(el => {
    el.addEventListener('click', closeModal)
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal()
  })

  // ── Search ────────────────────────────────────────────────────────────────

  let loaded = false

  const doSearch = debounce(async (query: string) => {
    if (!query.trim()) {
      showRecent(results)
      return
    }
    if (!loaded) {
      try {
        await loadIndex()
        loaded = true
      } catch (err) {
        console.error('[search] Failed to load index', err)
        return
      }
    }
    const hits = miniSearch!.search(query) as unknown as SearchResult[]
    renderResults(hits.slice(0, 10), results)
  }, 200)

  input.addEventListener('input', (e) => {
    doSearch((e.target as HTMLInputElement).value)
  })

  // Preload index on focus so first keystroke feels instant
  input.addEventListener('focus', () => {
    if (!loaded) loadIndex().then(() => { loaded = true }).catch(() => {})
  }, { once: true })
}

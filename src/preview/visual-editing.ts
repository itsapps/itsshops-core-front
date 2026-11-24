// Sanity Presentation overlay for preview renders. Bundled self-contained by tsup onSuccess into
// dist/assets/visual-editing/ (react, styled-components, @sanity/ui included) and served
// from the site itself — CDN builds (esm.sh) broke on @sanity/icons subpath imports.
import { enableVisualEditing } from '@sanity/visual-editing'

enableVisualEditing({
  history: {
    subscribe: (navigate) => {
      const handler = () => navigate({ type: 'push', url: location.pathname + location.search })
      window.addEventListener('popstate', handler)
      return () => window.removeEventListener('popstate', handler)
    },
    update: (update) => {
      if (update.type === 'push') window.history.pushState(null, '', update.url)
      else if (update.type === 'pop') window.history.back()
      else if (update.type === 'replace') window.history.replaceState(null, '', update.url)
    },
  },
  refresh: (payload) => {
    if (payload.source === 'mutation') {
      setTimeout(() => window.location.reload(), 300)
    }
    return false
  },
})

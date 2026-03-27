function hasDepth(url: string): boolean {
  return url.replace(/^\/|\/$/g, '').split('/').length > 1
}

export function linkActiveState(itemUrl: string, pageUrl: string): string {
  if (itemUrl === pageUrl) return 'aria-current="page"'
  if (hasDepth(itemUrl) && pageUrl.startsWith(itemUrl)) return 'data-state="active"'
  return ''
}

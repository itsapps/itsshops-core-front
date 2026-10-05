import { describe, it, expect } from 'vitest'
import { renderPortableText } from '../portableText'
import { addSystemUrls } from '../resolve/menus'

const linked = (markDef: any) => [{
  _type: 'block', _key: 'b', style: 'normal',
  markDefs: [{ _key: 'l', _type: 'internalLink', ...markDef }],
  children: [{ _type: 'span', _key: 's', text: 'Widerruf', marks: ['l'] }],
}]

describe('rich-text internal links to system pages', () => {
  it('links to the system page route', () => {
    const urlMap: Record<string, string> = {}
    addSystemUrls(urlMap, { orderWithdraw: '/de/widerruf/' })
    expect(renderPortableText(linked({ systemPage: 'orderWithdraw' }), urlMap))
      .toContain('<a href="/de/widerruf/">Widerruf</a>')
  })

  it('renders plain text when the feature is off', () => {
    const urlMap: Record<string, string> = {}
    addSystemUrls(urlMap, { orderWithdraw: '#' })
    const html = renderPortableText(linked({ systemPage: 'orderWithdraw' }), urlMap)
    expect(html).not.toContain('<a')
    expect(html).toContain('Widerruf')
  })

  it('still resolves document references', () => {
    expect(renderPortableText(linked({ reference: { _id: 'p1', _type: 'page', slug: 'agb' } }), { p1: '/de/agb/' }))
      .toContain('<a href="/de/agb/">Widerruf</a>')
  })
})

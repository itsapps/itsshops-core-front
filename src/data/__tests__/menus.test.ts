import { describe, it, expect } from 'vitest'
import { resolveMenus, ensureSystemPageLink } from '../resolve/menus'
import { makeCtx } from '../resolve/context'

const ctx = makeCtx('de', 'de', (key) => `t:${key}`)
const urls = { orderWithdraw: '/de/widerruf/' }
const str = (value: string) => [{ language: 'de', value }]

const rawMenus = (items: any[]) => [
  { _id: 'main', title: str('Main'), items: [] },
  { _id: 'legal', title: str('Legal'), items },
]
const ids = { main: ['main'], footer: ['legal'] }

describe('system menu links', () => {
  it('resolves url and falls back to the translated title', () => {
    const [, legal] = resolveMenus(rawMenus([{ _key: 'a', linkType: 'system', systemPage: 'orderWithdraw' }]), ctx, undefined, urls)
    expect(legal.items[0]).toMatchObject({ linkType: 'system', systemPage: 'orderWithdraw', url: '/de/widerruf/', title: 't:staticPages.orderWithdraw.title' })
  })

  it('ignores an editor title on the withdrawal link (label fixed by FAGG §13a)', () => {
    const [, legal] = resolveMenus(rawMenus([{ _key: 'a', title: str('Rücktritt'), linkType: 'system', systemPage: 'orderWithdraw' }]), ctx, undefined, urls)
    expect(legal.items[0].title).toBe('t:staticPages.orderWithdraw.title')
  })

  it('drops system links whose feature is off', () => {
    const [, legal] = resolveMenus(rawMenus([{ _key: 'a', linkType: 'system', systemPage: 'orderWithdraw' }]), ctx, undefined, { orderWithdraw: '#' })
    expect(legal.items).toEqual([])
  })

  it('appends the withdrawal link to the last footer menu when no rendered menu has it', () => {
    const menus = resolveMenus(rawMenus([{ _key: 'x', linkType: 'external', url: str('https://x.at') }]), ctx, undefined, urls)
    ensureSystemPageLink(menus, 'orderWithdraw', ids, ctx, urls)
    expect(menus[1].items.at(-1)).toMatchObject({ linkType: 'system', url: '/de/widerruf/' })
  })

  it('does not append when an editor placed it (also nested)', () => {
    const raw = rawMenus([])
    raw[0].items = [{ _key: 's', linkType: 'submenu', children: [{ _key: 'c', linkType: 'system', systemPage: 'orderWithdraw' }] }]
    const menus = resolveMenus(raw, ctx, undefined, urls)
    ensureSystemPageLink(menus, 'orderWithdraw', ids, ctx, urls)
    expect(menus[1].items).toEqual([])
  })

  it('does nothing when the feature is off', () => {
    const menus = resolveMenus(rawMenus([]), ctx, undefined, { orderWithdraw: '#' })
    ensureSystemPageLink(menus, 'orderWithdraw', ids, ctx, { orderWithdraw: '#' })
    expect(menus[1].items).toEqual([])
  })
})

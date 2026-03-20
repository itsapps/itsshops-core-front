import type { ResolveContext } from '../../types'
import type { ResolvedSettings, ResolvedShopSettings, ResolvedCompany, ResolvedAddress } from '../../types/data'

export function resolveSettings(
  raw: any,
  ctx: ResolveContext,
  urlMap: Record<string, string>,
): ResolvedSettings {
  return {
    _id:                  raw._id,
    siteTitle:            ctx.resolveString(raw.siteTitle),
    siteShortDescription: ctx.resolveString(raw.siteShortDescription),
    siteDescription:      ctx.resolvePortableText(raw.siteDescription),
    homePageUrl:          raw.homePage?._id    ? (urlMap[raw.homePage._id] ?? null) : null,
    homePageId:          raw.homePage?._id ?? null,
    privacyPage:          raw.privacyPage?._id ?? null,
    mainMenus:            (raw.mainMenus  ?? []).map((m: any) => m._ref),
    footerMenus:          (raw.footerMenus ?? []).map((m: any) => m._ref),
    gtmId:                raw.gtmId ?? null,
    company:              raw.company ? resolveCompany(raw.company, ctx) : null,
  }
}

function resolveCompany(raw: any, ctx: ResolveContext): ResolvedCompany {
  const addr = raw.address
  return {
    name:  ctx.resolveString(raw.name),
    owner: raw.owner ?? '',
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    vatId: raw.vatId ?? null,
    address: addr ? {
      line1:   addr.line1   ?? '',
      line2:   addr.line2   ?? '',
      zip:     addr.zip     ?? '',
      city:    ctx.resolveString(addr.city),
      country: addr.country ?? '',
    } satisfies ResolvedAddress : null,
  }
}

export function resolveShopSettings(raw: any, ctx: ResolveContext): ResolvedShopSettings {
  return {
    _id:                     raw._id,
    shopPageId:              raw.shopPage?._id ?? null,
    defaultCountry:          raw.defaultCountry
      ? { _id: raw.defaultCountry._id, countryCode: raw.defaultCountry.countryCode ?? '' }
      : null,
    freeShippingCalculation: raw.freeShippingCalculation ?? 'afterDiscount',
    stockThreshold:          raw.stockThreshold ?? null,
    defaultTaxCategory:      raw.defaultTaxCategory
      ? {
          _id:   raw.defaultTaxCategory._id,
          title: ctx.resolveString(raw.defaultTaxCategory.title),
          code:  raw.defaultTaxCategory.code ?? '',
        }
      : null,
    orderNumberPrefix:   raw.orderNumberPrefix   ?? null,
    invoiceNumberPrefix: raw.invoiceNumberPrefix ?? null,
    bankAccount:         raw.bankAccount
      ? { name: raw.bankAccount.name ?? '', bic: raw.bankAccount.bic ?? '', iban: raw.bankAccount.iban ?? '' }
      : null,
  }
}

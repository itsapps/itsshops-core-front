import type { ResolveContext, Extensions } from '../../types'
import type { ResolvedSettings, ResolvedShopSettings, ResolvedCompany, ResolvedAddress } from '../../types/data'
import { resolveFilterSpecs } from './filters'

export function resolveSettings(
  raw: any,
  ctx: ResolveContext,
  extensions?: Extensions,
): ResolvedSettings {
  return {
    _id:                  raw._id,
    siteTitle:            ctx.resolveString(raw.siteTitle),
    siteShortDescription: ctx.resolveString(raw.siteShortDescription),
    homePageId:           raw.homePage?._ref ?? null,
    privacyPageId:        raw.privacyPage?._ref ?? null,
    mainMenus:            (raw.mainMenus  ?? []).map((m: any) => m._ref),
    footerMenus:          (raw.footerMenus ?? []).map((m: any) => m._ref),
    gtmId:                raw.gtmId ?? null,
    company:              raw.company ? resolveCompany(raw.company, ctx, extensions) : null,
    defaultShareImage:    ctx.resolveBaseImage(raw.defaultShareImage) ?? null,
  }
}

function resolveCompany(raw: any, ctx: ResolveContext, extensions?: Extensions): ResolvedCompany {
  const addr = raw.address
  const { name, owner, email, phone, vatId, address: _addr, ...rest } = raw
  const extensionFields = extensions?.resolve?.company?.(rest, ctx) ?? {}
  return {
    name:  ctx.resolveString(name),
    owner: owner ?? '',
    email: email ?? null,
    phone: phone ?? null,
    vatId: vatId ?? null,
    address: addr ? {
      line1:   addr.line1   ?? '',
      line2:   addr.line2   ?? '',
      zip:     addr.zip     ?? '',
      city:    ctx.resolveString(addr.city),
      country: addr.country ?? '',
    } satisfies ResolvedAddress : null,
    ...extensionFields,
  }
}

export function resolveShopSettings(raw: any, ctx: ResolveContext): ResolvedShopSettings {
  return {
    filters: resolveFilterSpecs(raw.filters, ctx),
    _id:                     raw._id,
    shopPageId:              raw.shopPage?._ref ?? null,
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
    billingAddress: raw.billingAddress ? {
      line1:   raw.billingAddress.line1   ?? '',
      line2:   raw.billingAddress.line2   ?? '',
      zip:     raw.billingAddress.zip     ?? '',
      city:    ctx.resolveString(raw.billingAddress.city),
      country: raw.billingAddress.country ?? '',
    } satisfies ResolvedAddress : null,
    bankAccount:         raw.bankAccount
      ? { name: raw.bankAccount.name ?? '', bic: raw.bankAccount.bic ?? '', iban: raw.bankAccount.iban ?? '' }
      : null,
  }
}

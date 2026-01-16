import type { Config } from "@netlify/functions";
import { getLowStockProducts } from '../services/backend.mts';
import { createTranslationFromLocale } from '../translation.mjs';
import { getLocalizedValue, formatDate } from '../../shared/localize.mjs';
// import { sendMail } from '../services/mail.mts';
import { createSanityClient, createImageBuilder } from '../../shared/sanity.mjs'

export const defaultConfig: Config = {
  schedule: "0 5 * * *"
};

interface StockCheckOptions {
  isDev: boolean;
  shopAdminEmail: string;
  sanityStudioUrl: string;
  sendLowStock: boolean;
  locales: string[];
  defaultLocale: string;
  customerResources: Record<string, any>;
  sanity: Record<string, string>;
}

export const handler = async (request: Request, options: StockCheckOptions) => {
  if (!options.sendLowStock) {
    return
  }

  const sanityClient = createSanityClient({...options.sanity, apiVersion: ""});
  const data = await getLowStockProducts();
  if (data.products.length == 0 && data.variants.length == 0) {
    return
  }

  const defaultLocale = options.defaultLocale
  const t = createTranslationFromLocale(defaultLocale, options.isDev, options.locales, defaultLocale, options.customerResources);
  const allLocales = [...options.locales] as string[];
  const structureBaseUrl = `${options.sanityStudioUrl}/${defaultLocale}/structure/`
  
  const productLines: string[] = []
  data.products.forEach(p => {
    productLines.push(t('emails.stockLevels.infoLine', {
      title: getLocalizedValue(p, 'title', defaultLocale, defaultLocale, allLocales),
      editUrl: `${structureBaseUrl}shop;product;${p._id}`,
      stock: p.stock,
    }))
  })
  const variantLines: string[] = []
  data.variants.forEach(p => {
    variantLines.push(t('emails.stockLevels.infoLine', {
      title: getLocalizedValue(p, 'title', defaultLocale, defaultLocale, allLocales),
      // editUrl: `${structureBaseUrl}__edit__${p._id}${encodeURIComponent(",type=productVariant")}`,
      editUrl: `${structureBaseUrl}shop;product;${p.parentId};${p._id}${encodeURIComponent(",type=productVariant")}`,
      stock: p.stock,
    }))
  })
  // do nothing if no low stock
  if (productLines.length == 0 && variantLines.length == 0) {
    return
  }
  
  const now = new Date().toISOString()
  const html = `
    <h1>${t('emails.stockLevels.headline', {date: formatDate(now, defaultLocale, 'long', 'medium')})}</h1>
    ${productLines.length && (
      `<h2>${t('emails.stockLevels.products')}</h2>
      ${productLines.map(l => `<div>${l}</div>`).join('')}`
    )}
    ${variantLines.length && (`
      <h2>${t('emails.stockLevels.variants')}</h2>
      ${variantLines.map(l => `<div>${l}</div>`).join('')}`
    )}
  `
  const shopName = data.shopName ? getLocalizedValue(data, 'shopName', defaultLocale, defaultLocale, allLocales) : "Shop"
  try {
    await sendMail({
      from: `${shopName} <${options.shopAdminEmail}>`,
      to: options.shopAdminEmail,
      subject: t('emails.stockLevels.subject', {date: formatDate(now, defaultLocale, 'medium')}),
      text: html,
      html
    });
  } catch (error) {
    console.error(error);
  }
};

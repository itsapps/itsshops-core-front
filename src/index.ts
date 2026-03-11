export * from "./types";
import type { Config } from "./types";

import { setIgnores } from './config/debug';
import { loadTemplates } from './config/templates';
import { createFilters } from './filters';
import { createSanityClient } from './core';
import { cssConfig } from './config/css';
import { createVirtualTemplates } from './templates/virtual';
import { Hover } from './templates/components/hover';

export const shopCoreFrontendPlugin = async (eleventyConfig: any, options: Config) => {
  setIgnores(eleventyConfig);
  loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);

  if (!options.preview?.enabled) {
    cssConfig(eleventyConfig, options.tailwind);
  }

  // createVirtualTemplates(eleventyConfig);
  eleventyConfig.addShortcode("hover", (images: any) => {
    return Hover(images)
  })

  const client = createSanityClient(options.sanityClient);
  eleventyConfig.addGlobalData("cms", async () => {
    const products = await client.fetch(`*[_type == 'product']`)
    return {
      products: products.map((p:any) => ({
        ...p,
        slug: p.title?.[0].value || `unknown-${p._id}`,
        images: [0, 1, 2, 3, 4,5,6,7,8,9].map(i => ({
          src: "https://img.daisyui.com/images/stock/card-1.webp?x",
          alt: "Tailwind CSS 3D card" + i,
        }))
      }))
    }
  });
}
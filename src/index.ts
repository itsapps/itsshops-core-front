export * from "./types";
import type { Config } from "./types";

import { setIgnores } from './config/debug';
import { loadTemplates } from './config/templates';
import { createFilters } from './filters';
import { createSanityClient } from './core/clients/sanity';
import { cssConfig } from './config/css';
import { createVirtualTemplates } from './templates/virtual';

export const shopCoreFrontendPlugin = async (eleventyConfig: any, options: Config) => {
  setIgnores(eleventyConfig);
  // loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);

  
  if (!options.preview?.enabled) {
    cssConfig(eleventyConfig, options.tailwind);
  }

  createVirtualTemplates(eleventyConfig);

  // const client = createSanityClient(options.sanityClient);
  // const products = await client.fetch(`*[_type == 'product']`)
  // console.log("products: ", products);
}
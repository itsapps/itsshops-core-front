export * from "./types";

import { loadTemplates } from './config/templates';
import { createFilters } from './filters';
import { createSanityClient } from './core/clients/sanity';

export const shopCoreFrontendPlugin = async (eleventyConfig: any, options: any) => {
  loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);

  const client = createSanityClient(options.sanity);
  const products = await client.fetch('*[_type == product]')
  console.log("products: ", products);
}
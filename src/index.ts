import { loadTemplates } from './config/templates';
import { createFilters } from './config/filters';

export const shopCoreFrontendPlugin = (eleventyConfig: any, options: any) => {
  loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);
}
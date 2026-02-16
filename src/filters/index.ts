import { slugify, toIsoString } from "../utils";

export const createFilters = (eleventyConfig: any) => {
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toIsoString", toIsoString);
}

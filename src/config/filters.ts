import slugifyString from '@sindresorhus/slugify';

// import slugify from "@sindresorhus/slugify";
import dayjs from 'dayjs';

export const createFilters = (eleventyConfig: any) => {
  eleventyConfig.addFilter("slugify", slugify);
  eleventyConfig.addFilter("toISOString", toISOString);
}

export function slugify(text: string) {
  return slugifyString(text);
}
export function toISOString(text: string) {
  return dayjs(text).toISOString()
}
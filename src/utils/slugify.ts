import slugifyString from '@sindresorhus/slugify';

export function slugify(text: string) {
  return slugifyString(text);
}
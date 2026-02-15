import slugifyString from '@sindresorhus/slugify';

export function someFilter(value: any) {
  return `filtered value: ${slugifyString(value)}`;
}
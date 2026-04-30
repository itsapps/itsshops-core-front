import slugifyString from '@sindresorhus/slugify';

// decamelize:false — without this, all-caps titles like "AUS DEN DÖRFERN"
// produce "aus-den-d-oe-rfern" because the umlaut transliteration (Ö→Oe)
// looks like a camelCase boundary to the default decamelize logic.
export function slugify(text: string) {
  return slugifyString(text, { decamelize: false });
}

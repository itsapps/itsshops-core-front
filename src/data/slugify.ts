import slugifyString from '@sindresorhus/slugify';

// decamelize:false — without this, all-caps titles like "AUS DEN DÖRFERN"
// produce "aus-den-d-oe-rfern" because the umlaut transliteration (Ö→Oe)
// looks like a camelCase boundary to the default decamelize logic.
export function slugify(text: string) {
  return slugifyString(text, { decamelize: false });
}

/**
 * Slugify a (possibly nested) URL path, preserving `/` segment separators.
 * Each segment is slugified independently, so an author-entered page slug like
 * "references/Heiligenstein Deep Dive" becomes "references/heiligenstein-deep-dive"
 * (spaces/umlauts cleaned) while the intentional nesting is kept. Empty segments
 * (leading/trailing/double slashes) are dropped.
 */
export function slugifyPath(path: string) {
  return (path ?? '')
    .split('/')
    .map(segment => slugify(segment))
    .filter(Boolean)
    .join('/');
}

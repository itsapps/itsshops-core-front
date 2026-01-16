import slugifyString from '@sindresorhus/slugify';
import _ from 'lodash';
import dayjs from 'dayjs';
import {inspect} from "util";

export const getSanitySeo = (title, description, seo, locale, localizers) => {
  const { getLocalizedValue } = localizers;
  const metaTitle = seo ? (seo.metaTitle ? getLocalizedValue(seo, "metaTitle", locale) : title) : title;
  const shareTitle = seo ? (seo.shareTitle ? getLocalizedValue(seo, "shareTitle", locale) : metaTitle) : metaTitle;
  const metaDescription = (seo ? (seo.metaDescription ? getLocalizedValue(seo, "metaDescription", locale) : description) : description);
  const shareDescription = (seo ? (seo.shareDescription ? getLocalizedValue(seo, "shareDescription", locale) : metaDescription) : metaDescription);
  const shareImage = seo?.shareImage;
  
  return {
    metaTitle: (metaTitle || "").replace(/[\r\n\t]+/g, ' '),
    shareTitle: (shareTitle || "").replace(/[\r\n\t]+/g, ' '),
    metaDescription: metaDescription ? metaDescription.slice(0, 160).replace(/[\r\n\t]+/g, ' ') : "",
    shareDescription: shareDescription ? shareDescription.slice(0, 160).replace(/[\r\n\t]+/g, ' ') : "",
    shareImage,
    keywords: getLocalizedValue(seo, "keywords", locale) || "",
  }
}

export const getExcerpt = (portableText) => {
  if (!portableText) return {text: '', images: []};
  let texts = [];
  const images = [];

  for (const block of portableText) {
    if (block.children) {
      for (const child of block.children) {
        if (child.text) {
          // replace newlines/tabs with spaces
          const clean = child.text.replace(/[\r\n\t]+/g, ' ').trim();
          if (clean) {
            texts.push(clean);
          }
        }
      }
    } else if (block._type === 'customImage') {
      images.push(block);
    }
  }

  return {text: texts.join(' ').slice(0, 200).trim(), images};
};

export const slugify = (str, separator='-', lowercase=true) => {
	return slugifyString(str, {
		separator,
		lowercase
	});
};

export const getUniqueSlug = (slug, slugSet) => {
  let counter = 0
  let actualSlug = null
  while (!actualSlug) {
	actualSlug = slug
	if (counter > 0) {
	  actualSlug = `${slug}-${counter}`
	}
	if (slugSet.has(actualSlug)) {
	  actualSlug = null
	  counter++
	} else {
	  slugSet.add(actualSlug)
	  return actualSlug
	}
  }
}

export const uniqueFilteredArray = (array, filterValue) => {
	const values = new Set(array);
  const filteredValues = Array.from(values).filter(value => value !== filterValue);
	return filteredValues;
};

export const uniqueShuffeledStrings = (strings, filterValue, max=4) => {
  const filtered = uniqueFilteredArray(strings, filterValue);
  return _.shuffle(filtered).slice(0, max)
}

export const toIsoString = dateString => dayjs(dateString).toISOString();

export const readingTime = text => {
  let content = new String(text);
  const speed = 23; // reading speed in words per minute

  // remove all html elements
  let re = /(&lt;.*?&gt;)|(<.*?>)/gi;
  let plain = content.replace(re, '');

  // replace all newlines and 's with spaces
  plain = plain.replace(/\n+|'s/g, ' ');

  // create array of all the words in the post & count them
  let words = plain.split(' ');
  let count = words.length;

  // calculate the reading time
  const calculatedReadingTime = Math.round(count / speed);
  return calculatedReadingTime;
};

// export const keys = Object.keys;
// export const values = Object.values;
// export const entries = Object.entries;

export const toJson = JSON.stringify;
export const fromJson = JSON.parse;

// export const debug = (content) => `<pre>${inspect(content)}</pre>`;
export const encodeText = (text) => {
  return encodeURIComponent(text);
};
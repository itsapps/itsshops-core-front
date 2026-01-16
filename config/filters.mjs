import {toHTML} from '@portabletext/to-html'
import { vercelStegaSplit } from "@vercel/stega";

import {
  isBundleProduct as bundleProduct,
  isSanityVariant as sanityVariant,
} from '../data/enums.mjs';

/**
 * @typedef {Object} Reference
 * @property {string} _type
 * @property {string} _id
 */

/**
 * @typedef {Object} InternalLink
 * @property {string} _type
 * @property {Reference} reference
 * @property {string} displayType
 * @property {Object} reference
 */

/**
 * @param {Dictionary} parent - Dictionary with info about parent object (containing the data)
 * @param {InternalLink} internalLink 
 * @param {string} locale 
 * @param {string | null} content 
 * @param {function} referenceMaps 
 * @param {string} sourceMapPath 
 * @param {string} documentId 
 * @param {string} documentType
 */
export const internalLinkToHTML = (getLocalizedValue, createDataSanity, addError, isPreview, referenceMaps, internalLink, parent, locale, content, sourceMapPath, documentId, documentType) => {
  let href = "#";
  let text = content;
  const classNames = (internalLink.displayType ? (internalLink.displayType === "button" ? "btn is-large" : "") : "");

  if (referenceMaps && internalLink.reference) {
    const refs = referenceMaps(locale)[internalLink.reference._type];
    if (refs) {
      const ref = refs[internalLink.reference._id];
      if (ref) {
        href = ref.permalink;
        if (!text) {
          text = ref.title;
        }
      } else {
        // addError({
        //   message: `Could not find reference ${internalLink.reference._id} for type ${internalLink.reference._type}`
        // });
        addError({
          "parent": parent,
          "internalLink": internalLink,
          "locale": locale,
        })
      }
    }
  }

  if (!text && internalLink.reference) {
    text = getLocalizedValue(internalLink.reference, "title", locale);
  }
  const { cleaned, encoded } = vercelStegaSplit(text || 'No Title');
  if (isPreview) {
    if (sourceMapPath && documentId && documentType) {
      return `<a class="${classNames}" href="${href}" ${createDataSanity(
        documentId,
        documentType,
        sourceMapPath
      )}'>${cleaned}</a>`;
    }
    return `<a class="${classNames} relative" href="${href}">${encoded ? `${cleaned}<span class="stega-item">${encoded}</span>` : cleaned}</a>`;
  } else {
    return `<a class="${classNames}" href="${href}">${cleaned}</a>`;
  }
}

/**
 * Convert Sanity Portable Text data into HTML using custom components.
 *
 * @param {Dictionary} parent - Dictionary with info about parent object (containing the data)
 * @param {Array<Object>} data - Array of Portable Text blocks from Sanity
 * @param {string} locale - The locale to use for localized fields and links
 * @param {Object<string, any> | undefined} referenceMaps - Reference maps for resolving internal links
 * @returns {string} The generated HTML string
 *
 * @example
 * const html = portableTextToHTML(portableTextData, "en", referenceMaps);
 */
export const portableTextToHTML = (isPreview, sanityPicture, youtube, pictureSizes, data, parent, locale, referenceMaps=undefined) => {
  const components = {
    block: {
      normal: ({children}) => {
        return toStega(children, "p");
      },
      h2: ({children}) => {
        return toStega(children, "h2");
      },
    },
    types: {
      customImage: ({value}) => {
        if (!value || !value.asset) return "";
        const picture = sanityPicture({
          image: value,
          pictureSize: pictureSizes.dynamicFullscreen,
          imageClassNames: "fade-in",
          fallbackAlt: value.alt,
          loading: "lazy",
        })
        return picture ? `<div>${picture}</div>` : "";
      },
      youtube: ({value}) => {
        return youtube(value, {locale})
      },
    },
    list: {
      bullet: ({children}) => {
        return `<ul class="bullets">${children}</ul>`
      }
    },
    listItem: {
      bullet: ({children}) => {
        return toStega(children, "li");
      },
      number: ({children}) => {
        return toStega(children, "li");
      }
    },
    marks: {
      internalLink: ({value, children}) => {
        return internalLinkToHTML(value, parent, locale, children, referenceMaps)
      },
      link: ({value, children}) => {
        const classNames = (value.displayType ? (value.displayType === "button" ? "btn is-large" : "") : "");
        return `<a class="${classNames}" href="${value.href}">${children}</a>`;
        // return `<a target="_blank" href="${value.href}">${children}</a>`
      },
      html: ({ value, children }) => {
        const Tag = value?.tag || 'span';
        return `<${Tag}>${children}</${Tag}>`;
      },
      strong: ({children}) => {
        return toStega(children, "strong");
      },
      left: ({children}) => {
        return `<div class="text-left">${children}</div>`
      },
      center: ({children}) => {
        return `<div class="text-center">${children}</div>`
      },
      right: ({children}) => {
        return `<div class="text-right">${children}</div>`
      },
    }
  }
  
  const cleanData = isPreview ? data.map(block => {
    if (block.style) {
      const { cleaned } = vercelStegaSplit(block.style)
      block.style = cleaned
    }
    if (block.listItem) {
      const { cleaned } = vercelStegaSplit(block.listItem)
      block.listItem = cleaned
    }

    return block
  }) : data
  const html = toHTML(cleanData, {
    components: components,
  })
  return html
}

export const isBundleProduct = bundleProduct
export const isSanityVariant = sanityVariant
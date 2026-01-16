import { createDataAttribute } from "@sanity/visual-editing"
import { vercelStegaSplit } from "@vercel/stega";

export const createDataSanity = (ignore, id, type, path) => {
  if (ignore) return "";
  
  const attr = createDataAttribute({ 
    id, 
    type,
    path
  })
  return `data-sanity='${attr().toString()}'`;
}

export const stega = (ignore, text) => {
  if (ignore) return text;

  const { cleaned, encoded } = vercelStegaSplit(text);
  if (!encoded) return cleaned;
  return `${encoded}<span>${cleaned}</span>`;
}

/**
 * @param {string} content 
 * @param {string} tag 
 */
export const toStega = (ignore, content, tag) => {
  if (ignore) {
    return `<${tag}>${content}</${tag}>`;
  }
  const { cleaned, encoded } = vercelStegaSplit(content);
  return `<${tag} class="relative">${encoded ? `${cleaned}<span class="stega-item">${encoded}</span>` : cleaned}</${tag}>`;
}
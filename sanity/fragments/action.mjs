
export default function action({internalLink}) {
  return `
    _type,
    _key,
    title,
    internalLink {${internalLink}}
  `;
}

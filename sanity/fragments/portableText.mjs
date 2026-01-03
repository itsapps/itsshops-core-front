export function portableText({ internalLink, customImage, youtube }) {
  return `
    _type == "complexPortableText" => {
      ...,
      markDefs[]{
        ...,
        _type == "internalLink" => { ${internalLink} }
      }
    },
    _type == "customImage" => { ${customImage} },
    _type == "youtube" => { ${youtube} }
  `;
}


export default function slide({localeImage}) {
  return `
    _type == "localeImage" => {${localeImage}}
  `;
}

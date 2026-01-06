
export default function column({ localizedComplexPortableText, youtube }) {
  return `
    _type == 'localeComplexPortable' => {
      _type,_key,${localizedComplexPortableText}
    },
    _type == 'youtube' => {
      _type,_key,${youtube}
    },
  `;
}

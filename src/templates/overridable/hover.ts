export type Image = {
  src: string
  alt?: string
}
export const Hover = (images: Image[]): string => {
  return images.map(image => {
    return `
    <div class="hover-3d">
      <!-- content -->
      <figure class="w-20 rounded-2xl">
        <img src="${image.src}" alt="${image.alt || 'nix'}" />
      </figure>
      <!-- 8 empty divs needed for the 3D effect -->
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
    `
  }).join('')
}


/* © Andy Bell - https://buildexcellentwebsit.es/ */

type Token = { name: string; min: number; max: number }
type Viewport = { min: number; max: number }

export const clampGenerator = (tokens: Token[], viewport: Viewport) => {
  const rootSize = 16;

  return tokens.map(({name, min, max}) => {
    if (min === max) {
      return { name, value: `${min / rootSize}rem` };
    }

    const minSize = min / rootSize;
    const maxSize = max / rootSize;
    const minViewport = viewport.min / rootSize;
    const maxViewport = viewport.max / rootSize;
    const slope = (maxSize - minSize) / (maxViewport - minViewport);
    const intersection = -1 * minViewport * slope + minSize;

    return {
      name,
      value: `clamp(${minSize}rem, ${intersection.toFixed(2)}rem + ${(slope * 100).toFixed(2)}vw, ${maxSize}rem)`
    };
  });
};

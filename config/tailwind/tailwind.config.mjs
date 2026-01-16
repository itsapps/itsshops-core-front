/* © Andy Bell - https://buildexcellentwebsit.es/ */

import plugin from 'tailwindcss/plugin.js';
import postcss from 'postcss';
import postcssJs from 'postcss-js';
import DefaultTheme from 'tailwindcss/defaultTheme.js';

import {clampGenerator} from './css-utils/clamp-generator.mjs';
import {tokensToTailwind} from './css-utils/tokens-to-tailwind.mjs';

// Raw design tokens
import defaultColors from './design-tokens/colors.js';
import defaultFontFamilies from './design-tokens/fonts.js';
import defaultSpacings from './design-tokens/spacing.js';
import defaultTextSizes from './design-tokens/text-sizes.js';

// Process design tokens
// const colors = tokensToTailwind(colorTokens.items);
// const fontFamily = tokensToTailwind(fontTokens.items);
// const fontSize = tokensToTailwind(clampGenerator(textSizeTokens.items));
// const spacing = tokensToTailwind(clampGenerator(spacingTokens.items));
// const screens = {
//   xs: '30em',
//   sm: '40em',
//   md: '50em',
//   tablet: '60em',
//   lg: '80em'
// }

function mergeByKey(base, overrides, matchKey = "name") {
  const overrideMap = Object.fromEntries(
    overrides.map(item => [item[matchKey], item])
  );

  return base.map(item =>
    overrideMap[item[matchKey]]
      ? { ...item, ...overrideMap[item[matchKey]] }
      : item
  );
}



export function getTailwindConfig({
  viewport = { min: 320, max: 1350 },
  screens = {
    xs: '30em',
    sm: '40em',
    md: '50em',
    tablet: '60em',
    lg: '80em'
  },
  colors = [],
  fontFamilies = [],
  textSizes = [],
  spacings = []
} = {}) {
  const colorTokens = tokensToTailwind(mergeByKey(defaultColors.items, colors))
  const fontFamilyTokens = tokensToTailwind(mergeByKey(defaultFontFamilies.items, fontFamilies))
  const fontSizeTokens = tokensToTailwind(clampGenerator(mergeByKey(defaultTextSizes.items, textSizes), viewport))
  const spacingTokens = tokensToTailwind(clampGenerator(mergeByKey(defaultSpacings.items, spacings), viewport))

  const screenVariants = Object.keys(screens);

  return {
    experimental: {
      optimizeUniversalDefaults: true
    },
    content: [
      // './src/**/*.{html,js,jsx,mdx,njk,liquid,webc}',
      './src/**/*.{html,njk,ts,mjs}',
      '!./src/_includes/css/**',
      '!./src/_includes/scripts/**',
      '!./src/assets/scripts/lib/**',
    ],
    // presets: [],
    safelist: [
      {
        pattern: /grid-cols-/,
        variants: screenVariants,
      },
      {
        // pattern: /col-span-(1|2|3)/,
        pattern: /col-span-/,
        variants: screenVariants,
      },
      {
        pattern: /col-start-/,
        variants: screenVariants,
      },
      {
        pattern: /justify-self-/,
        variants: screenVariants,
      },
      {
        pattern: /self-/,
        variants: screenVariants,
      },
      {
        pattern: /object-contain/,
      },
      // {
      //   pattern: /max-w-/,
      // },
      // {
      //   pattern: /bg-/,
      // },
      {
        pattern: /text-(left|center|right)/,
      },
    ],
    theme: {
      screens,
      colors: colorTokens,
      spacing: {
        // ...DefaultTheme.spacing,
        ...spacingTokens
      },
      fontSize: fontSizeTokens,
      fontFamily: fontFamilyTokens,
      fontWeight: {
        normal: 400,
        bold: 700,
        black: 800
      },
      // inset: DefaultTheme.inset,
      zIndex: DefaultTheme.zIndex,
      backgroundColor: ({theme}) => theme('colors'),
      textColor: ({theme}) => theme('colors'),
      margin: ({theme}) => ({
        auto: 'auto',
        ...theme('spacing')
      }),
      padding: ({theme}) => ({
        auto: 'auto',
        ...theme('spacing')
      }),
      // gridTemplateColumns: DefaultTheme.gridTemplateColumns,
      // gridColumn: DefaultTheme.gridColumn,
      // extend: {
      //   gridTemplateColumns: {
      //     // Simple 16 column grid
      //     '16': 'repeat(16, minmax(0, 1fr))',

      //     // Complex site-specific column configuration
      //     'footer': '200px minmax(900px, 1fr) 100px',
      //   }
      // }
    },
    variantOrder: [
      'first',
      'last',
      'odd',
      'even',
      'visited',
      'checked',
      'empty',
      'read-only',
      'group-hover',
      'group-focus',
      'focus-within',
      'hover',
      'focus',
      'focus-visible',
      'active',
      'disabled'
    ],

    // Disables Tailwind's reset etc
    corePlugins: {
      preflight: false
    },
    plugins: [
      // Generates custom property values from tailwind config
      plugin(function ({addComponents, config}) {
        let result = '';

        const currentConfig = config();

        const groups = [
          {key: 'colors', prefix: 'color'},
          {key: 'spacing', prefix: 'space'},
          {key: 'fontSize', prefix: 'size'},
          {key: 'fontFamily', prefix: 'font'}
        ];

        groups.forEach(({key, prefix}) => {
          const group = currentConfig.theme[key];

          if (!group) {
            return;
          }

          Object.keys(group).forEach(key => {
            // e.g. --color-primary: #ff00ff
            // or   --space-xs: clamp(0.75rem, 0.69rem + 0.29vw, 0.9375rem)
            // or   --size-step-0: clamp(1rem, 0.92rem + 0.39vw, 1.25rem);
            // or   --font-base: Outfit, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif;
            result += `--${prefix}-${key}: ${group[key]};`;
          });
        });
        const res = postcssJs.objectify(postcss.parse(result));
        addComponents({
          ':root': res
        });
      }),

      // Generates custom utility classes
      plugin(function ({addUtilities, config}) {
        const currentConfig = config();
        const customUtilities = [
          {key: 'spacing', prefix: 'flow-space', property: '--flow-space'},
          {key: 'colors', prefix: 'spot-color', property: '--spot-color'}
        ];

        customUtilities.forEach(({key, prefix, property}) => {
          const group = currentConfig.theme[key];

          if (!group) {
            return;
          }

          Object.keys(group).forEach(key => {
            addUtilities({
              [`.${prefix}-${key}`]: postcssJs.objectify(
                postcss.parse(`${property}: ${group[key]}`)
              )
            });
          });
        });
      })
    ]
  }
}

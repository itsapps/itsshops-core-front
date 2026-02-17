import * as path from 'path';
import { fileURLToPath } from "url"
import plugin from 'tailwindcss/plugin.js';
import type { Config } from 'tailwindcss'
import postcss from 'postcss';
import postcssJs from 'postcss-js';

import { clampGenerator } from './src/config/tailwind/utils/clampGenerator';
import { tokensToTailwind } from './src/config/tailwind/utils/tokensToTailwind';
import defaultColors from './src/config/tailwind/tokens/colors';
import defaultFontFamilies from './src/config/tailwind/tokens/fonts';
import defaultSpacings from './src/config/tailwind/tokens/spacing';
import defaultTextSizes from './src/config/tailwind/tokens/textSizes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewport = { min: 320, max: 1350 }
const colorTokens = tokensToTailwind(defaultColors.items)
const fontFamilyTokens = tokensToTailwind(defaultFontFamilies.items)
const fontSizeTokens = tokensToTailwind(clampGenerator(defaultTextSizes.items, viewport))
const spacingTokens = tokensToTailwind(clampGenerator(defaultSpacings.items, viewport))

// console.log("core in tailwind.config.ts dirname:", __dirname)
const config: Config = {
  content: [
    "./src/**/*.{html,js,ts,njk,md}", // make sure your virtual templates are included here
    `${__dirname}/**/*.{html,js,ts,njk,md}`,
    // `${"/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-front/dist"}/**/*.{html,js,ts,njk,md}`,
  ],
  theme: {
    colors: colorTokens,
    screens: {
      xs: '30em',
      sm: '40em',
      md: '50em',
      tablet: '60em',
      lg: '80em'
    },
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
    backgroundColor: ({theme}) => theme('colors'),
    textColor: ({theme}) => theme('colors'),
    margin: ({theme}: any) => ({
      auto: 'auto',
      ...theme('spacing')
    }),
    padding: ({theme}: any) => ({
      auto: 'auto',
      ...theme('spacing')
    }),    
  },
  plugins: [
    plugin(function ({addBase, config}) {
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
      addBase({
        ':root': res
      });
    }),

    // Generates custom utility classes
    plugin(function ({addBase, config}) {
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
          addBase({
            [`.${prefix}-${key}`]: postcssJs.objectify(
              postcss.parse(`${property}: ${group[key]}`)
            )
          });
        });
      });
    })
  ]
};
export default config
import * as path from 'path';
import { fileURLToPath } from "url"
// import plugin from 'tailwindcss/plugin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // plugins: [
    
  // ],
  content: [
    "./src/**/*.{html,js,ts,njk,md}", // make sure your virtual templates are included here
    `${__dirname}/**/*.{html,js,ts,njk,md}`,
    // `${"/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-front/dist"}/**/*.{html,js,ts,njk,md}`,
  ],
  theme: {
    screens: {
    xs: '30em',
    sm: '40em',
    md: '50em',
    tablet: '60em',
    lg: '80em'
  },
    extend: {},
  },
};

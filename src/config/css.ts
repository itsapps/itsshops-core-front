import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from "url";
import config from '../../tailwind.config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cssConfig = (eleventyConfig: any) => {
  eleventyConfig.on('eleventy.before', async () => {
    // const tailwindInputPath = path.resolve('./src/assets/css/style.css');
    // const tailwindOutputPath = './dist/styles/index.css';
    console.log("core in css.ts dirname:", __dirname)

    const tailwindInputPath = path.resolve(
      __dirname,
      "./assets/css/style.css"
    );

    // 🔥 output into customer build folder
    const tailwindOutputPath = path.resolve(
      process.cwd(),
      "dist/styles/index.css"
    );

    const cssContent = fs.readFileSync(tailwindInputPath, 'utf8');
    const outputDir = path.dirname(tailwindOutputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // const tailwindConfigPath = path.resolve(process.cwd(), 'tailwind.config.js');
    const result = await postcss([tailwindcss()]).process(cssContent, {
      from: tailwindInputPath,
      to: tailwindOutputPath,
    });

    fs.writeFileSync(tailwindOutputPath, result.css);
  });
}
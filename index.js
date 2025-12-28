import fs from "fs"
import path from "path"
import Nunjucks from "nunjucks"
import { fileURLToPath } from "url"

import priceData from "./shortcodes/priceData.js"

// Convert current module URL to a directory path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function shopCoreFrontend(eleventyConfig) {
  eleventyConfig.addPlugin(shopCoreFrontend)

  let nunjucksEnvironment = new Nunjucks.Environment(
		new Nunjucks.FileSystemLoader([
      path.resolve("src/_includes"),
      path.resolve("node_modules/@itsapps/itsshops-core-front"),
    ], { noCache: true })
	);
	eleventyConfig.setLibrary("njk", nunjucksEnvironment);

  
  // eleventyConfig.addShortcode("priceData", priceData)
  eleventyConfig.addNunjucksGlobal("priceData", priceData)

  const templatePath = path.join(
    __dirname, "templates", "something.njk"
  )
  const templateContent = fs.readFileSync(templatePath, "utf-8")

  eleventyConfig.addTemplate("something.njk", templateContent)

  // return {
  //   dir: {
  //     input: 'src',
  //     output: 'dist',
  //     // includes: '_includes',
  //     layouts: '_layouts'
  //   },
  //   dataTemplateEngine: 'njk',
  //   htmlTemplateEngine: 'njk',
  // };
  
}
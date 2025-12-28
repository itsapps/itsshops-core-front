import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

import priceData from "./shortcodes/priceData.js"

// Convert current module URL to a directory path
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default function shopCoreFrontend(eleventyConfig) {
  // eleventyConfig.addShortcode("priceData", priceData)
  eleventyConfig.addNunjucksGlobal("priceData", priceData)

  const templatePath = path.join(
    __dirname, "templates", "something.njk"
  )
  const templateContent = fs.readFileSync(templatePath, "utf-8")

  eleventyConfig.addTemplate("something.njk", templateContent)
}
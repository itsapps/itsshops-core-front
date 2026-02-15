// src/index.ts
import * as fs from "fs";
import * as path from "path";
import Nunjucks from "nunjucks";
import { fileURLToPath } from "url";

// src/config/filters.ts
import slugifyString from "@sindresorhus/slugify";
function someFilter(value) {
  return `filtered value: ${slugifyString(value)}`;
}

// src/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var getPackageRoot = () => {
  return __dirname.includes("dist") ? path.resolve(__dirname, "..") : path.resolve(__dirname);
};
var coreRoot = getPackageRoot();
var templatesRoot = path.join(coreRoot, "templates");
var layoutsDir = path.join(templatesRoot, "layouts");
var shopCoreFrontendPlugin = (eleventyConfig, options) => {
  console.log("baseConfig: ", options.baseConfig);
  let nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader([
      path.resolve("src/_includes"),
      templatesRoot
    ], { noCache: true })
  );
  eleventyConfig.setLibrary("njk", nunjucksEnvironment);
  eleventyConfig.setNunjucksEnvironmentOptions({
    throwOnUndefined: true
  });
  if (fs.existsSync(layoutsDir)) {
    for (const file of fs.readdirSync(layoutsDir)) {
      if (!file.endsWith(".njk")) continue;
      const customerLayoutPath = path.join(process.cwd(), eleventyConfig.directories.layouts, file);
      if (fs.existsSync(customerLayoutPath)) {
        continue;
      }
      const content = fs.readFileSync(path.join(layoutsDir, file), "utf-8");
      let layoutPath = eleventyConfig.directories.getLayoutPathRelativeToInputDirectory(file);
      eleventyConfig.addTemplate(layoutPath, content);
    }
  } else {
    console.warn(`No layouts found  at: ${layoutsDir}`);
  }
  const buildMode = "normal";
  const customerPagesRoot = path.join(eleventyConfig.directories.input, "pages");
  console.log(`\u{1F50D} Checking for pages at: ${customerPagesRoot}`);
  if (fs.existsSync(customerPagesRoot)) {
    for (const dir of fs.readdirSync(customerPagesRoot)) {
      const dirPath = path.join(customerPagesRoot, dir);
      if (!fs.statSync(dirPath).isDirectory()) continue;
      for (const file of fs.readdirSync(dirPath)) {
        if (!file.endsWith(".njk")) continue;
        if (shouldIgnoreTemplate({
          mode: buildMode,
          previewType: "options.preview.documentType",
          dir,
          file,
          features: {}
        })) {
          eleventyConfig.ignores.add(path.join(dirPath, file));
        }
      }
    }
  }
  const corePagesRoot = path.join(templatesRoot, "pages");
  for (const dir of fs.readdirSync(corePagesRoot)) {
    const dirPath = path.join(corePagesRoot, dir);
    if (!fs.statSync(dirPath).isDirectory()) continue;
    for (const file of fs.readdirSync(dirPath)) {
      if (!file.endsWith(".njk")) continue;
      const customerPath = path.join(customerPagesRoot, dir, file);
      const corePath = path.join(dirPath, file);
      if (!shouldIgnoreTemplate({
        mode: buildMode,
        previewType: "options.preview.documentType",
        dir,
        file,
        features: {}
      }) && !fs.existsSync(customerPath)) {
        eleventyConfig.addTemplate(`pages/${dir}/${file}`, fs.readFileSync(corePath, "utf8"));
      }
    }
  }
  const coreMiscPagesRoot = path.join(templatesRoot, "misc");
  const walkAndAdd = (currentDirPath, relativePath = "") => {
    const entries = fs.readdirSync(currentDirPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentDirPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);
      if (entry.isDirectory()) {
        walkAndAdd(entryPath, entryRelativePath);
      } else if (entry.isFile() && entry.name.endsWith(".njk")) {
        const customerPath = path.join(customerPagesRoot, entryRelativePath);
        if (!fs.existsSync(customerPath)) {
          eleventyConfig.addTemplate(
            path.join("misc", entryRelativePath),
            fs.readFileSync(entryPath, "utf8")
          );
        } else {
          throw new Error(`Conflict detected: You are not allowed to override the core template at: ${customerPath}`);
        }
      }
    }
  };
  if (fs.existsSync(coreMiscPagesRoot)) {
    walkAndAdd(coreMiscPagesRoot);
  }
  eleventyConfig.addFilter("someFilter", someFilter);
};
function shouldIgnoreTemplate({
  mode,
  // 'preview' | 'maintenance' | 'normal'
  previewType,
  // 'page' | 'post'
  dir,
  file,
  features
}) {
  if (mode === "preview") {
    if (dir !== "preview") return true;
    return file !== `${previewType}s.njk`;
  }
  if (mode === "maintenance") {
    return !(dir === "maintenance" && file === "maintenance.njk");
  }
  if (dir === "standard") {
    return false;
  } else if (dir === "preview") {
    return false;
  }
  if (dir === "maintenance") return true;
  return false;
}
export {
  shopCoreFrontendPlugin
};

import path from 'path'
import { CoreContext } from '../types';

export const setupIgnores = (ctx: CoreContext) => {
  const { eleventyConfig, config } = ctx
  eleventyConfig.setUseGitIgnore(false);
  
  // Always ignore build artefacts and OS noise when watching
  eleventyConfig.watchIgnores.add("**/.DS_Store");
  eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "css"));
  eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "scripts"));

  if (config.debug.enabled) {
    // Watch core dist templates when developing core itself via npm link
    console.log('Debug mode: watching core dist templates in node_modules')
    const pkgPath = path.dirname(new URL(import.meta.url).pathname)
    const distPath = path.resolve(pkgPath, 'templates')
    eleventyConfig.addWatchTarget(distPath)
    eleventyConfig.watchIgnores.delete("**/node_modules/**")
  }
  
  eleventyConfig.ignores.add("node_modules");
  eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "css"));
  eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "scripts"));
  // isDev && eleventyConfig.addWatchTarget(templatesRoot);
  // isDev && eleventyConfig.addWatchTarget('./src/assets/**/*.{css,ts,js,mjs,svg,png,jpeg}');
}
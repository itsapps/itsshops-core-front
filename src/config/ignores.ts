import path from 'path'
import { PluginConfigs } from '../types';

export const setupIgnores = (configs: PluginConfigs) => {
  const { eleventyConfig, config } = configs
  eleventyConfig.setUseGitIgnore(false);
  
  if (config.dev.enabled) {
    console.log('Debug mode enabled: watching for changes in node_modules and templates')
    eleventyConfig.watchIgnores.add("**/.DS_Store");
    eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "css"));
    eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "scripts"));

    // Watch the core dist folder for changes during development
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
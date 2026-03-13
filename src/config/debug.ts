import path from 'path'

export const setIgnores = (eleventyConfig: any) => {
  eleventyConfig.setUseGitIgnore(false);
  const isDev = true
  isDev && eleventyConfig.watchIgnores.add("**/.DS_Store");
  eleventyConfig.ignores.add("node_modules");
  eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "css"));
  // eleventyConfig.ignores.add(path.join(eleventyConfig.directories.includes, "scripts"));
  isDev && eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "css"));
  // isDev && eleventyConfig.watchIgnores.add(path.join(eleventyConfig.directories.includes, "scripts"));
  // isDev && eleventyConfig.addWatchTarget(templatesRoot);
  // isDev && eleventyConfig.addWatchTarget('./src/assets/**/*.{css,ts,js,mjs,svg,png,jpeg}');
  
  const debug = process.env.ITSSHOPS_CORE_DEBUG;
  if (debug) {
    const pkgPath = path.dirname(new URL(import.meta.url).pathname)
    const distPath = path.resolve(pkgPath, 'templates')
    eleventyConfig.addWatchTarget(distPath, { resetConfig: true })
    eleventyConfig.watchIgnores.delete("**/node_modules/**")
  }
}
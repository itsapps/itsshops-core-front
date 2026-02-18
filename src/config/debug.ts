export const setIgnores = (eleventyConfig: any) => {
  eleventyConfig.setUseGitIgnore(false);
  
  const debug = process.env.ITSSHOPS_CORE_DEBUG;
  if (debug) {
    eleventyConfig.addWatchTarget(
      "./node_modules/@itsapps/itsshops-core-front/dist/*.{js,njk}", {
        resetConfig: true
      }
    );
    eleventyConfig.watchIgnores.delete("**/node_modules/**");
  }
}
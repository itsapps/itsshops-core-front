import type { Locale, PluginConfigs } from "../types";
import { sanityPicture, imageUrl } from "../media";

export const createShortcodes = (configs: PluginConfigs) => {
  const { eleventyConfig } = configs
  
  eleventyConfig.addShortcode("sanityPicture", sanityPicture);
}

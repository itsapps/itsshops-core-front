export * from "./types";
import type { Config } from "./types";

import { loadTemplates } from './config/templates';
import { createFilters } from './filters';
import { createSanityClient } from './core/clients/sanity';

export const shopCoreFrontendPlugin = async (eleventyConfig: any, options: Config) => {
  const nunjucksEnvironment = loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);

  eleventyConfig.addTemplate("virtual.11ty.js", function(data: any) {
    return nunjucksEnvironment.renderString("<h1>{{ title }}</h1>{% include 'components/bla.njk' %}", {title: data});
  }, {
    pagination: {
      data: "testdata",
      size: 1,
      alias: "item",
    },
    testdata: [
      "item1",
      "item2",
      "item3",
      "item4"
    ],
    permalink: function (data: any) {
      return `different/${data.item}/index.html`;
    },
  });

  const client = createSanityClient(options.sanityClient);
  const products = await client.fetch(`*[_type == 'product']`)
  console.log("products: ", products);
}
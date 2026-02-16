export * from "./types";
import type { Config } from "./types";

import { loadTemplates } from './config/templates';
import { createFilters } from './filters';
import { createSanityClient } from './core/clients/sanity';
import { cssConfig } from './config/css';

export const shopCoreFrontendPlugin = async (eleventyConfig: any, options: Config) => {
  loadTemplates(eleventyConfig);

  createFilters(eleventyConfig);
  cssConfig(eleventyConfig);

  eleventyConfig.addTemplate("virtual.11ty.js", function(data: any) {
    return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${ data.item }</title>
        <link rel="stylesheet" href="/styles/index.css">
      </head>
      <body class="prose">
        <div class="md:p-16 p-8">
          <button class="btn btn-primary">hallo</button>
          <button class="btn btn-secondary">secondary</button>
          <button class="btn btn-accent">accent</button>
          <button
  class="inline-block cursor-pointer rounded-md bg-gray-800 px-4 py-3 text-center text-sm font-semibold uppercase text-white transition duration-200 ease-in-out hover:bg-gray-900">
  Button
</button>
<input type="checkbox" value="synthwave" class="toggle theme-controller" />
        </div>
      </body>
    </html>
    `
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
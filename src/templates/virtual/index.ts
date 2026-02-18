import { Hover } from "../components/hover";

export const createVirtualTemplates = async (eleventyConfig: any) => {
  const images = ["1", "2"].map((image) => ({
    src: "https://img.daisyui.com/images/stock/card-1.webp?x",
    alt: "Tailwind CSS 3D card" + image,
  }));
  eleventyConfig.addTemplate("virtual.11ty.js", function(data: any) {
    const body = `
      <div class="flex">
        <button class="btn btn-primary">Preview</button>
        <h1>${data.product.title[0].value}</h1>
      </div>
      <div class="flex">
        ${Hover(images)}
      </div>
    `;
    return body
    // return baseLayout({
    //   title: data.product.name,
    //   content: body
    // });
  }, {
    layout: "base_simple.njk",
    pagination: {
      data: "cms.products",
      size: 1,
      alias: "product",
    },
    testdata: [
      {
        name: "Product 1",
        slug: "product-1",
        images
      },
      {
        name: "Product 2",
        slug: "product-2",
        images
      },
    ],
    permalink: function (data: any) {
      return `different/${data.product.slug}/index.html`;
    },
  });
}

type BaseLayoutProps = {
  title?: string
  content: string
}
export function baseLayout({ title, content }: BaseLayoutProps) {
  return `
  <!doctype html>
  <html lang="de">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/styles/index.css">
      <title>${title ?? ""}</title>
    </head>
    <body>
      <main class="relative mx-auto max-w-[50em]">
        ${content}
      </main>
    </body>
  </html>
  `;
}

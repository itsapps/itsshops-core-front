// src/netlify/functions/preview.ts
import Eleventy from "@11ty/eleventy";
var preview = async (props) => {
  console.log("projectConfig: ", props.projectConfig);
  let result = "Nothing here yet blablabla";
  try {
    const elev = new Eleventy("src", void 0, {
      configPath: "eleventy.config.mts",
      quietMode: true
    });
    const results = await elev.toJSON();
    result = results[0].content;
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      result = error.message;
    }
  }
  return new Response(result, {
    headers: {
      "content-type": "text/html"
    }
  });
};
export {
  preview
};

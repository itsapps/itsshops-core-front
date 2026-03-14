import fs from 'node:fs'
import type { Context } from "@netlify/functions";
// @ts-ignore - Importing Eleventy which might lack types
import Eleventy from '@11ty/eleventy'
// import path from 'path';
// import * as fs from 'fs';

interface ElevResult {
  inputPath: string;
  content: string;
}

export type PreviewParams = {
  request: Request;
  context: Context;
  // projectConfig: any
}

export const preview = async (props: PreviewParams) => {
  const { locale, documentType, documentId } = props.context.params;
  console.log('core preview', locale, documentType, documentId);
  // console.log("projectConfig: ", props.projectConfig);
  // try {
  //   const root = process.cwd();
  //   const srcPath = path.join(root, "src");
  //   if (!fs.existsSync(srcPath)) {
  //     throw new Error(`CORE: srcPath at ${srcPath} does not exist!`);
  //   }

  //   const configPath = path.join(root, "eleventy.config.mts");
  //   const configExists = fs.existsSync(configPath);
  //   console.log(`CORE: configPath at ${configPath} exists?`, configExists);

  // } catch (err) {
  //   return new Response(`CORE: ${err}`, { status: 500 });
  // }
  
  // const coreModulePath = path.join(root, "node_modules", "@itsapps", "itsshops-core-front2");
  // console.log(`coreModulePath at ${coreModulePath} exists?`, fs.existsSync(coreModulePath));
  process.env.IS_PREVIEW = 'true'
  process.env.PREVIEW_TYPE = documentType
  process.env.PREVIEW_LOCALE = locale
  process.env.PREVIEW_PERSPECTIVE = 'drafts'

  const cssFile = 'src/_includes/css/global.css'
  const cssExistsBefore = fs.existsSync(cssFile)
  console.log('[preview] CSS file exists before run:', cssExistsBefore)

  let result = "Nothing here"
  try {
    const elev = new Eleventy('src', undefined, {
      configPath: 'eleventy.config.mts',
      quietMode: true
    });

    // Don’t write to disk — just render in memory
    const results = (await elev.toJSON()) as unknown as ElevResult[]
    console.log('[preview] CSS file exists after run:', fs.existsSync(cssFile))

    result = results?.[0]?.content
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
      result = error.message
    }
  }
  // return result
  // return "result"
  return new Response(result, {
    headers: {
      "content-type": "text/html",
    }
  });
};

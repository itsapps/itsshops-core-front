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
  // const [locale, documentType, documentId] = props.context.params.splat.split('/')
  const { locale, documentType, documentId } = props.context.params;
  console.log('core preview', locale, documentType, documentId);

  const url = new URL(props.request.url);
  const perspective = url.searchParams.get('sanity-preview-perspective');

  process.env.IS_PREVIEW = 'true'
  process.env.PREVIEW_TYPE = documentType
  process.env.PREVIEW_LOCALE = locale
  process.env.PREVIEW_PERSPECTIVE = perspective || 'drafts'

  const templatePath = `preview/${documentType}s.njk`

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

    // Find matching template
    const match = results.find((r) => {
      // if (filter && r.data.slug === filter) return true;
      if (templatePath && r.inputPath.endsWith(templatePath)) return true;
      return false;
    });

    if (!match) {
      throw new Error(`No matching template found for documentId: ${documentId}`);
    }

    return match.content
    // result = results?.[0]?.content
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
      "cache-control": "no-store",
      "Netlify-Vary": "query=sanity-preview-perspective",
    }
  });
};

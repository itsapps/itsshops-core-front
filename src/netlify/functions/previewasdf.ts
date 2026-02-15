import type { Context, Config } from "@netlify/functions";
// @ts-ignore - Importing Eleventy which might lack types
import Eleventy from '@11ty/eleventy'
import { pathToFileURL } from 'url';
import path from 'path';
import * as fs from 'fs';

interface ElevResult {
  inputPath: string;
  content: string;
}

// export const coreConfig = {
//   path: "/preview"
// };
export const config: Config = {
  path: "/preview" 
};

export default async function (request: Request, context: Context): Promise<Response> {
  let result = "bla"
  // const inputDir = "./src";
  const root = process.cwd();
  console.log("--- DEBUG START ---");
  console.log("Current Working Directory:", root);
  
  try {
    console.log("Files in root:", fs.readdirSync(root));
    
    const nodeModulesPath = path.join(root, "node_modules", "@itsapps", "itsshops-core-front2");
    if (fs.existsSync(nodeModulesPath)) {
      console.log("Core Package found at:", nodeModulesPath);
      console.log("Core Package contents:", fs.readdirSync(nodeModulesPath));
      if (fs.existsSync(path.join(nodeModulesPath, "dist"))) {
         console.log("Dist contents:", fs.readdirSync(path.join(nodeModulesPath, "dist")));
      }
    } else {
      console.log("CRITICAL: Core Package NOT found in node_modules!");
    }
  } catch (err) {
    console.log("Diagnostic failed:", (err as Error).message);
  }
  console.log("--- DEBUG END ---");

  // Point explicitly to the files included via included_files
  const inputDir = path.join(root, "src");
  const configPath = path.join(root, "eleventy.config.mts");

  const configUrl = pathToFileURL(configPath).href;
  const absoluteConfigPath = path.join(root, "eleventy.config.mts");

  console.log("configPath", configPath);
  console.log("absoluteConfigPath", absoluteConfigPath);

  console.log("Checking for input directory at:", inputDir);
  if (!fs.existsSync(inputDir)) {
    console.error("INPUT DIRECTORY MISSING!");
    // fs.mkdirSync(inputDir, { recursive: true });
    // fs.writeFileSync(path.join(inputDir, "index.md"), "# Fallback Content");
    // This helps you see if it's a path issue or a missing file issue
  }
  
  try {
    const elev = new Eleventy(inputDir, undefined, {
      configPath: absoluteConfigPath,
      quietMode: true
    });

    // Don’t write to disk — just render in memory
    const results = (await elev.toJSON()) as unknown as ElevResult[]

    result = results[0].content
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

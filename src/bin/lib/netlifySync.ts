import fs from 'fs-extra';
import path from 'path';
import * as TOML from '@iarna/toml';
import _  from 'lodash';

export async function syncNetlifyConfig({dev = false} = {}) {
  const userConfigPath = path.join(process.cwd(), 'netlify.config.mts');
  let userConfig = {};
  if (await fs.pathExists(userConfigPath)) {
    const {default: netlify} = await import(userConfigPath);
    if (netlify) userConfig = netlify;
  }

  // const externalModules = new Set(["@sindresorhus/slugify"]);
  // const includedFiles = new Set([
  //   "eleventy.config.mts",
  //   "src/**",
  //   "shared/**",
  //   "tsconfig.json",
  //   "node_modules/@sindresorhus/**",
  // ]);

  // const externalModules = new Set([
  //   // "@itsapps/itsshops-core-front2",
  //   // "@11ty/eleventy",
  //   // "@sindresorhus/slugify",
  // ]);
  // const includedFiles = new Set([
  //   "package.json",
  //   "eleventy.config.mts",
  //   // "src/**",
  //   // "shared/**",
  //   // "templates/**",
  //   // "tsconfig.json",
  //   // "node_modules/@sindresorhus/**",
  //   // "node_modules/@itsapps/**",
  //   // "node_modules/@itsapps/itsshops-core-front2/netlify/**"
  //   // "node_modules/@itsapps/itsshops-core-front2/**",
  //   // "node_modules/@itsapps/itsshops-core-front2/templates/**",
  //   // "node_modules/@itsapps/itsshops-core-front2/dist/**",
  // ]);
  
  // external?.forEach(mod => externalModules.add(mod));
  // include?.forEach(file => includedFiles.add(file));
  // const {functions={}, ...configOverrides} = userConfig;

  const config = _.merge(
    {
      build: {
        command: "npm run build",
        publish: "dist",
      },
      dev: {
        autoLaunch: false,
      },
    },
    userConfig,
  )

  // const configObject = {
  //   ...config,
  //   functions: {
  //     preview: {
  //       node_bundler: "esbuild",
  //       external_node_modules: Array.from(externalModules),
  //       included_files: Array.from(includedFiles)
  //     }
  //   }
  // };
  if (!dev) {
    delete config.dev;
  }
  const toml = TOML.stringify(config);
  await fs.writeFile('netlify.toml', toml);

  // const root = process.cwd();
  // const tomlPath = path.join(root, 'customer-netlify.toml');

  // // These are the "Non-negotiable" settings for your framework
  // const frameworkSettings = {
  //   build: {
  //     command: "npm run build",
  //     publish: "dist",
  //   },
  //   dev: {
  //     autoLaunch: false,
  //   },
  //   functions: {
  //     preview: {
  //       node_bundler: "esbuild",
  //       external_node_modules: ["@sindresorhus/slugify"],
  //       included_files: [
  //         "eleventy.config.mts",
  //         "src/**",
  //         "shared/**",
  //         "tsconfig.json",
  //         "node_modules/@sindresorhus/**"
  //       ]
  //     }
  //   }
  // };

  // let config = {};
  // if (await fs.pathExists(tomlPath)) {
  //   try {
  //     config = TOML.parse(await fs.readFile(tomlPath, 'utf8'));
  //   } catch (e) {
  //     console.warn("⚠️ Existing netlify.toml is invalid. Overwriting...");
  //   }
  // }

  // // Deep merge functions config
  // const mergedConfig = {
  //   ...config,
  //   ...frameworkSettings
  // };

  // await fs.writeFile(tomlPath, TOML.stringify(mergedConfig));
  console.log("🚀 Netlify configuration synchronized.");
}
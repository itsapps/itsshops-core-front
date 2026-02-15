#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
// import { syncNetlifyConfig } from './lib/netlifySync.js';

const program = new Command();

program
  .name('itsshops')
  .description('✨ itsshops - The core toolkit for your shop frontend')
  .version('1.0.0');

program
  .command('eleventy')
  .description('🚀 Run eleventy')
  // .hook('preAction', async () => {
  //   await syncNetlifyConfig({dev: true});
  // })
  .option('-e, --env <path>', 'Path to environment file', '.env')
  .option('--serve', 'Start the local server')
  .option('--watch', 'Watch for file changes')
  .action((options) => {
    console.log(`\n📦 ITSSHOPS | Run eleventy...\n`);

    // 1. Prepare Base Arguments for Node
    const nodeArgs = [
      "--import", "tsx",
      "./node_modules/@11ty/eleventy/cmd.cjs",
      "--config=eleventy.config.mts"
    ];

    // 2. Handle Env File Logic
    const root = process.cwd();
    const envPath = path.resolve(root, options.env);
    if (fs.existsSync(envPath)) {
      nodeArgs.unshift(`--env-file=${envPath}`);
      console.log(`✅ Env loaded: ${options.env}`);
    } else {
      // If the user specifically asked for a custom file but it's missing
      if (options.env !== '.env') {
        console.error(`❌ Error: Env file not found at ${envPath}`);
        process.exit(1);
      }
      console.log(`ℹ️  No .env file found. Skipping flag.`);
    }

    // 3. Add 11ty specific flags
    if (options.serve) nodeArgs.push('--serve');
    if (options.watch) nodeArgs.push('--watch');

    // debugging attach
    // nodeArgs.unshift("--inspect-brk=9229");

    console.log(`🛠️  Running: node ${nodeArgs.join(' ')}\n`);

    // 4. Spawn the process
    const child = spawn('node', nodeArgs, { 
      stdio: 'inherit', 
      shell: true,
      cwd: root 
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✨ Eleventy completed successfully!`);
      } else {
        console.log(`\n⚠️ Build failed with code ${code}`);
        process.exit(code);
      }
    });
  });

program
  .command('netlify')
  .description('🚀 Start netlify dev')
  // .hook('preAction', async () => {
  //   await syncNetlifyConfig({dev: true});
  // })
  .action(() => {
    console.log(`\n📦 ITSSHOPS | Starting netlify functions...\n`);

    // 2. Handle Env File Logic
    const root = process.cwd();
    console.log(`🛠️  Running: netlify dev\n`);

    const child = spawn('netlify', ['dev'], { 
      stdio: 'inherit', 
      shell: true,
      cwd: root,
    });

    child.on('error', (err) => {
      console.error('❌ Failed to start Netlify. Is it installed globally?');
      console.error(err);
    });
  });

program
  .command('clean')
  .description('🚀 Clean files and folders')
  .action((options) => {
    console.log(`\n📦 ITSSHOPS | clean files...\n`);

    const foldersToClean = [
      'dist',
      'src/_includes/css',
      'src/_includes/scripts',
    ];

    foldersToClean.forEach(folder => {
      const fullPath = path.join(root, folder);
      
      // fs.rmSync with recursive + force is the native 'rimraf'
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✔ Removed ${folder}`);
      }
    });
  });

program.parse();
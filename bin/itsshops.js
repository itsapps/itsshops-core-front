#!/usr/bin/env node
import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('itsshops')
  .description('✨ itsshops - The core toolkit for your shop frontend')
  .version('1.0.0');

program
  .command('serve')
  .description('🚀 Start the development server')
  .option('-e, --env <path>', 'Path to environment file', '.env')
  .option('--no-serve', 'Do not start the local server')
  .option('--watch', 'Do not watch for file changes')
  .option('--clean', 'Delete the dist folder before building')
  .action((options) => {
    const projectRoot = process.cwd();
    const envPath = path.resolve(projectRoot, options.env);
    
    console.log(`\n📦 ITS SHOPS | Starting development mode...\n`);

    // 1. Prepare Base Arguments for Node
    const nodeArgs = [
      "--import", "tsx",
      "./node_modules/@11ty/eleventy/cmd.cjs",
      "--config=eleventy.config.mts"
    ];
    //"build": "tsx ./node_modules/@11ty/eleventy/cmd.cjs --config=eleventy.config.mts",

    // 2. Handle Env File Logic
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
    
    // clean if desired
    if (options.clean) {
      const foldersToClean = [
        'dist',
        'src/_includes/css',
        'src/_includes/scripts',
        '.netlify'
      ];

      foldersToClean.forEach(folder => {
        const fullPath = path.join(process.cwd(), folder);
        
        // fs.rmSync with recursive + force is the native 'rimraf'
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`  ✔ Removed ${folder}`);
        }
      });
    }

    console.log(`🛠️  Running: node ${nodeArgs.join(' ')}\n`);

    // 4. Spawn the process
    const child = spawn('node', nodeArgs, { 
      stdio: 'inherit', 
      shell: true,
      cwd: projectRoot 
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.log(`\n⚠️  Process exited with code ${code}`);
      }
    });
  });

program
  .command('build')
  .description('🏗️  Build the static site for production')
  .option('-e, --env <path>', 'Path to environment file', '.env')
  .action((options) => {
    const projectRoot = process.cwd();
    const envPath = path.resolve(projectRoot, options.env);
    
    console.log(`\n📦 ITS SHOPS | Building for production...\n`);

    const nodeArgs = [
      "--import", "tsx",
      "./node_modules/@11ty/eleventy/cmd.cjs",
      "--config=eleventy.config.mts"
    ];

    // Env logic (Reuse your logic from serve)
    if (fs.existsSync(envPath)) {
      nodeArgs.unshift(`--env-file=${envPath}`);
      console.log(`✅ Env loaded: ${options.env}`);
    } else if (options.env !== '.env') {
      console.error(`❌ Error: Env file not found at ${envPath}`);
      process.exit(1);
    }

    console.log(`🚀 Running build command...\n`);

    const child = spawn('node', nodeArgs, { 
      stdio: 'inherit', 
      shell: true,
      cwd: projectRoot 
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✨ Build completed successfully!`);
      } else {
        console.log(`\n⚠️  Build failed with code ${code}`);
        process.exit(code); // Ensure CI/CD (Netlify) knows the build failed
      }
    });
  });

program.parse();
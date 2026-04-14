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
  .command('eleventy')
  .description('🚀 Run eleventy')
  .option('-e, --env <path>', 'Path to environment file', '.env')
  .option('--serve', 'Start the local server')
  .option('--watch', 'Watch for file changes')
  .option('--mode <mode>', 'Build mode: normal (default), preview, maintenance')
  .option('--dev', 'Enable debug features (verbose errors, undefined warnings)')
  // .option('--debug', 'Enable Debug mode')
  .option('--debug [namespace]', 'Enable Debug mode, optional: * , Benchmark, Watch, "Template,Benchmark,FileSystemSearch,Eleventy", etc.')
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
    // if (options.debug) {
    //   nodeArgs.unshift('DEBUG=Eleventy*');
    // }

    // debugging attach
    // nodeArgs.unshift("--inspect-brk=9229");

    console.log(`🛠️  Running: node ${nodeArgs.join(' ')}\n`);

    // const debugNamespace = options.debug === true
    //   ? 'Eleventy*'
    //   : `Eleventy:${options.debug}`;
    const debugNamespace: string = options.debug === true
      ? 'Eleventy*'
      : typeof options.debug === 'string'
        ? options.debug
            .split(',')
            .map((ns: string) => ns.trim())
            .filter(Boolean)
            .map((ns: string) => ns.includes('Eleventy:') ? ns : (ns === 'Eleventy' ? 'Eleventy' : `Eleventy:${ns}`))
            .join(',')
        : '';
    console.log(`Debug namespace: ${debugNamespace}\n`);

    const envVars = {
      ...process.env,
      ...(options.dev && { ITSSHOPS_DEBUG: 'true' }),
      ...(options.mode === 'preview'     && { IS_PREVIEW: 'true' }),
      ...(options.mode === 'maintenance' && { MAINTENANCE: 'true' }),
      ...(options.debug && { DEBUG: debugNamespace })
    };
    // 4. Spawn the process
    const child = spawn('node', nodeArgs, { 
      stdio: 'inherit', 
      shell: true,
      cwd: root,
      env: envVars
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
  .action(() => {
    console.log(`\n📦 ITSSHOPS | Starting netlify functions...\n`);

    // 2. Handle Env File Logic
    const root = process.cwd();
    console.log(`🛠️  Running: netlify dev\n`);

    const child = spawn('netlify', ['dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: root,
      env: {
        ...process.env,
        URL: process.env.URL || 'http://localhost:8888',
      },
    });

    child.on('error', (err) => {
      console.error('❌ Failed to start Netlify. Is it installed globally?');
      console.error(err);
    });
  });

const NETLIFY_TOML = `[build]
command = "npm run build"
publish = "dist"

[dev]
command = "npm run dev"
dist = "dist"
autoLaunch = false
envFiles = [ ".env" ]

[functions]
  [functions.preview]
  included_files = [
    "src/**",
    "eleventy.config.mts",
    "itsshops.config.mts",
    "node_modules/**"
  ]
`

program
  .command('init')
  .description('Scaffold required config files for a new project')
  .option('--force', 'Overwrite existing files')
  .action((options) => {
    console.log(`\n📦 ITSSHOPS | init...\n`);
    const root = process.cwd();

    const files: [string, string][] = [
      ['netlify.toml', NETLIFY_TOML],
    ]

    for (const [filename, content] of files) {
      const dest = path.join(root, filename)
      if (fs.existsSync(dest) && !options.force) {
        console.log(`  ⏭ Skipped ${filename} (already exists — use --force to overwrite)`)
      } else {
        fs.writeFileSync(dest, content, 'utf-8')
        console.log(`  ✔ Written ${filename}`)
      }
    }
  });

program
  .command('clean')
  .description('🚀 Clean files and folders')
  .action(() => {
    console.log(`\n📦 ITSSHOPS | clean files...\n`);

    const foldersToClean = [
      'dist',
      'src/_includes/css',
      'src/_includes/scripts',
    ];

    const root = process.cwd();
    foldersToClean.forEach(folder => {
      const fullPath = path.join(root, folder);
      
      // fs.rmSync with recursive + force is the native 'rimraf'
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✔ Removed ${folder}`);
      }
    });
  });

// ── Sanity commands ────────────────────────────────────────────────────────────

const sanity = program
  .command('sanity')
  .description('Sanity data operations');

function loadEnv() {
  const root = process.cwd();
  const envPath = path.resolve(root, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function getSanityClient() {
  const { createClient } = await import('@sanity/client');
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  const token = process.env.SANITY_TOKEN;
  if (!projectId || !dataset || !token) {
    console.error('Missing SANITY_PROJECT_ID, SANITY_DATASET, or SANITY_TOKEN in environment');
    process.exit(1);
  }
  return createClient({ projectId, dataset, token, apiVersion: 'v2025-05-25', useCdn: false });
}

sanity
  .command('query')
  .description('Run a GROQ query')
  .argument('<groq>', 'GROQ query string')
  .action(async (groq: string) => {
    loadEnv();
    const client = await getSanityClient();
    const result = await client.fetch(groq);
    console.log(JSON.stringify(result, null, 2));
  });

sanity
  .command('delete')
  .description('Delete documents by type')
  .argument('<types>', 'Comma-separated document types (e.g. orderMeta,order)')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(async (types: string, options: { dryRun?: boolean }) => {
    loadEnv();
    const client = await getSanityClient();
    const typeList = types.split(',').map(t => t.trim()).filter(Boolean);

    for (const type of typeList) {
      const ids: string[] = await client.fetch(`*[_type == $type]._id`, { type });
      console.log(`${type}: ${ids.length} document(s)`);

      if (options.dryRun || ids.length === 0) continue;

      for (const id of ids) {
        await client.delete(id);
        console.log(`  deleted ${id}`);
      }
    }
  });

sanity
  .command('count')
  .description('Count documents by type')
  .argument('<types>', 'Comma-separated document types')
  .action(async (types: string) => {
    loadEnv();
    const client = await getSanityClient();
    const typeList = types.split(',').map(t => t.trim()).filter(Boolean);

    for (const type of typeList) {
      const count: number = await client.fetch(`count(*[_type == $type])`, { type });
      console.log(`${type}: ${count}`);
    }
  });

program.parse();
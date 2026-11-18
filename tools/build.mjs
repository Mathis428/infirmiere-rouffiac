// Assemble les scripts du site (src/ → assets/js/) avec esbuild.
// npm run build   : une fois, minifié. Les fichiers principaux portent une empreinte
//                   (main-XXXX.js, admin-XXXX.js) et les pages sont mises à jour :
//                   les visiteurs reçoivent toujours la dernière version, sans cache périmé.
// npm run watch   : reconstruit à chaque modification (fichiers sans empreinte)
import { context, build } from 'esbuild';
import { rm, readFile, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

// Script principal → page où il est chargé (chemin relatif depuis la page).
const PAGES = [
  { name: 'main', page: 'index.html', prefix: 'assets/js/' },
  { name: 'admin', page: 'rdv/index.html', prefix: '../assets/js/' },
];

await rm('assets/js', { recursive: true, force: true });

const options = {
  entryPoints: ['src/main.js', 'src/admin.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'assets/js',
  entryNames: watch ? '[name]' : '[name]-[hash]',
  chunkNames: 'chunks/[name]-[hash]',
  minify: !watch,
  sourcemap: watch,
  target: ['es2022', 'safari16'],
  legalComments: 'eof',
  logLevel: 'info',
  metafile: true,
};

async function link(name, file) {
  const { page, prefix } = PAGES.find((p) => p.name === name);
  const html = await readFile(page, 'utf8');
  const pattern = new RegExp(`${prefix.replace(/[.]/g, '\\.')}${name}(-[A-Z0-9]+)?\\.js`);
  const next = html.replace(pattern, prefix + file);
  if (next !== html) await writeFile(page, next);
  console.log(`${page} → ${prefix}${file}`);
}

if (watch) {
  for (const { name } of PAGES) await link(name, `${name}.js`);
  const ctx = await context(options);
  await ctx.watch();
} else {
  const result = await build(options);
  for (const { name } of PAGES) {
    const out = Object.keys(result.metafile.outputs).find((o) => new RegExp(`assets/js/${name}-[A-Z0-9]+\\.js$`).test(o));
    await link(name, out.split('/').pop());
  }
}

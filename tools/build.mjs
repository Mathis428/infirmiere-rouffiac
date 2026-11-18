// Assemble les scripts du site (src/ → assets/js/) avec esbuild.
// npm run build   : une fois, minifié. Le nom du fichier principal contient une
//                   empreinte (main-XXXX.js) et index.html est mis à jour : les
//                   visiteurs reçoivent toujours la dernière version, sans cache périmé.
// npm run watch   : reconstruit à chaque modification (fichier main.js, sans empreinte)
import { context, build } from 'esbuild';
import { rm, readFile, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

await rm('assets/js', { recursive: true, force: true });

const options = {
  entryPoints: ['src/main.js'],
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

async function linkInPage(file) {
  const html = await readFile('index.html', 'utf8');
  const next = html.replace(/assets\/js\/main(-[A-Z0-9]+)?\.js/, file);
  if (next !== html) await writeFile('index.html', next);
}

if (watch) {
  await linkInPage('assets/js/main.js');
  const ctx = await context(options);
  await ctx.watch();
} else {
  const result = await build(options);
  const entry = Object.keys(result.metafile.outputs).find((o) => /assets\/js\/main-[A-Z0-9]+\.js$/.test(o));
  await linkInPage(entry);
  console.log(`index.html → ${entry}`);
}

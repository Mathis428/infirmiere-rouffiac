// Assemble les scripts du site (src/ → assets/js/) avec esbuild.
// npm run build   : une fois, minifié
// npm run watch   : reconstruit à chaque modification
import { context, build } from 'esbuild';
import { rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

await rm('assets/js', { recursive: true, force: true });

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: 'assets/js',
  chunkNames: 'chunks/[name]-[hash]',
  minify: !watch,
  sourcemap: watch,
  target: ['es2022', 'safari16'],
  legalComments: 'eof',
  logLevel: 'info',
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}

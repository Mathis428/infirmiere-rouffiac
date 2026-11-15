// Exporte les deux faces de la carte en images (image de secours sans 3D, aperçu de partage).
// Nécessite le serveur local (npm run serve) et Microsoft Edge ou Chrome.
// Lancer : node tools/export-card.mjs
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import sharp from 'sharp';

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error('Aucun navigateur Chrome ou Edge trouvé.');

const url = process.env.URL || 'http://localhost:4173/tools/card-export.html';
const dom = await new Promise((resolve, reject) =>
  execFile(
    browser,
    ['--headless=new', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', url],
    { maxBuffer: 64 * 1024 * 1024 },
    (error, stdout) => (error ? reject(error) : resolve(stdout)),
  ),
);

const json = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/)?.[1];
if (!json) throw new Error('Export vide : le serveur local tourne-t-il ?');
const faces = JSON.parse(json.replaceAll('&quot;', '"'));

for (const [face, dataUrl] of Object.entries(faces)) {
  const name = face === 'back' ? 'carte-verso' : 'carte-recto';
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  const info = await sharp(buffer).resize({ width: 1200 }).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(`assets/img/${name}.png`);
  console.log(`assets/img/${name}.png  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} Ko`);
}

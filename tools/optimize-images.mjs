// Prépare les photos du site : recadrage, redimensionnement, WebP + JPEG.
// Les originaux restent dans sources/ (non publiés). Lancer : npm run images
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const OUT = 'assets/img';
await mkdir(OUT, { recursive: true });

// ratio : largeur / hauteur du recadrage (null = garder l'original)
// focus : position du recadrage (voir sharp « position »)
const jobs = [
  { src: 'sources/portrait-isabelle-buisson.webp', name: 'isabelle-buisson', ratio: 3 / 4, focus: 'top', widths: [320, 480] },
  { src: 'sources/photos/chateaumontialoux.jpg', name: 'saint-bauzile', ratio: 4 / 3, focus: 'centre', widths: [600, 900] },
  { src: 'sources/photos/fr-48-balsieges3.jpg', name: 'balsieges', ratio: 4 / 3, focus: 'bottom', widths: [600, 900] },
  { src: 'sources/photos/brenoux-l-eglise-et-le-village.jpg', name: 'brenoux', ratio: 4 / 3, focus: 'left', widths: [600, 890] },
  { src: 'sources/photos/france-lozere-lanuejols-mausolee-romain-1.jpg', name: 'lanuejols', ratio: 4 / 3, focus: 'centre', widths: [600, 900] },
  { src: 'sources/photos/mende-pont-notre-dame-205.jpg', name: 'pont', ratio: 4 / 3, focus: 'centre', widths: [600, 900] },
  { src: 'sources/photos/saint-etienne-du-valdonnez-02.jpg', name: 'vallee', ratio: 4 / 3, focus: 'centre', widths: [600, 900] },
];

for (const job of jobs) {
  const meta = await sharp(job.src).metadata();
  for (const width of job.widths) {
    let pipeline = sharp(job.src).rotate();
    if (job.ratio) {
      const height = Math.round(width / job.ratio);
      pipeline = pipeline.resize(width, height, { fit: 'cover', position: job.focus || 'centre' });
    } else {
      pipeline = pipeline.resize({ width: Math.min(width, meta.width) });
    }
    const base = `${OUT}/${job.name}-${width}`;
    await pipeline.clone().webp({ quality: 74, effort: 5 }).toFile(`${base}.webp`);
    const info = await pipeline.clone().jpeg({ quality: 76, mozjpeg: true, progressive: true }).toFile(`${base}.jpg`);
    console.log(`${base}  ${info.width}×${info.height}`);
  }
}

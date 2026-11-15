// Dessine les deux faces de la carte de visite d'Isabelle Buisson (recto et verso)
// sur un canvas 2D. Sert de texture à la carte 3D et d'image de secours.
// Proportions d'une carte de visite : 85 × 55 mm.

export const CARD_RATIO = 85 / 55;

// Un seul rouge, le même que sur le site (--red dans style.css).
export const RED = '#d8312e'; // mesuré sur les photos de sa carte
const PAPER = '#ffffff';
const WHITE = '#ffffff';

// Lato : la police de sa carte de visite, aussi utilisée sur le site.
const SANS = '"Lato", "Segoe UI", Arial, sans-serif';

export async function ensureCardFonts() {
  if (!document.fonts) return;
  await Promise.allSettled([
    document.fonts.load(`400 64px ${SANS}`),
    document.fonts.load(`700 64px ${SANS}`),
    document.fonts.load(`900 64px ${SANS}`),
    document.fonts.load(`italic 400 64px ${SANS}`),
  ]);
}

export function createFaceCanvas(face, width = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width / CARD_RATIO);
  const ctx = canvas.getContext('2d');
  if (face === 'back') drawBack(ctx, canvas.width, canvas.height);
  else drawFront(ctx, canvas.width, canvas.height);
  return canvas;
}

// ---------------------------------------------------------------- recto

export function drawFront(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // La vague rouge : bord haut qui monte de gauche à droite.
  const edge = (dy = 0) => {
    ctx.moveTo(0, H * (0.5 + dy));
    ctx.bezierCurveTo(W * 0.26, H * (0.425 + dy), W * 0.62, H * (0.398 + dy), W, H * (0.404 + dy));
  };
  wave(ctx, W, H, edge);

  // Logo : cœur et stéthoscope.
  heartLogo(ctx, W * 0.138, H * 0.215, W * 0.074, W * 0.0068);

  // Nom et titre.
  ctx.fillStyle = RED;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  fitText(ctx, 'Isabelle BUISSON', W * 0.262, H * 0.226, W * 0.5, `700 ${W * 0.0505}px ${SANS}`);
  ctx.font = `italic 400 ${W * 0.0312}px ${SANS}`;
  ctx.fillText('Infirmière libérale DE', W * 0.262, H * 0.318);

  // Caducée.
  caduceus(ctx, W * 0.872, H * 0.165, W * 0.062, W * 0.0052);

  // Texte blanc dans la vague.
  const cx = W * 0.682;
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'center';
  ctx.font = `400 ${W * 0.0352}px ${SANS}`;
  ctx.fillText('Soins à domicile sur RDV :', cx, H * 0.552);

  ctx.font = `700 ${W * 0.0372}px ${SANS}`;
  const phone = '07-72-19-85-91';
  const pw = ctx.measureText(phone).width;
  const iconSize = W * 0.034;
  const gap = W * 0.016;
  const startX = cx - (pw + iconSize + gap) / 2;
  phoneIcon(ctx, startX, H * 0.655 - iconSize * 0.86, iconSize, WHITE);
  ctx.textAlign = 'left';
  ctx.fillText(phone, startX + iconSize + gap, H * 0.655);

  ctx.textAlign = 'center';
  ctx.font = `400 ${W * 0.0352}px ${SANS}`;
  ctx.fillText('Secteur du Valdonnez :', cx, H * 0.757);
  ctx.font = `400 ${W * 0.0312}px ${SANS}`;
  ctx.fillText('Saint-Bauzile, Balsièges,', cx, H * 0.845);
  ctx.fillText('Brenoux, Lanuéjols', cx, H * 0.917);
  ctx.restore();
}

// ---------------------------------------------------------------- verso

export function drawBack(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const edge = (dy = 0) => {
    ctx.moveTo(0, H * (0.552 + dy));
    ctx.bezierCurveTo(W * 0.3, H * (0.452 + dy), W * 0.66, H * (0.398 + dy), W, H * (0.4 + dy));
  };
  wave(ctx, W, H, edge);

  nurseIcon(ctx, W * 0.032, H * 0.055, W * 0.096, W * 0.0054);
  houseIcon(ctx, W * 0.745, H * 0.19, W * 0.135, W * 0.0054);

  ctx.fillStyle = RED;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  fitText(ctx, 'Soins à domicile :', W * 0.45, H * 0.25, W * 0.46, `900 ${W * 0.056}px ${SANS}`, 'center');

  const items = [
    'Soins aux personnes âgées ou dépendantes',
    'Soins post-opératoires',
    'Suivi maladies chroniques',
    'Prises de sang',
    'Pansements simples et complexes',
    'Injections',
  ];
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'right';
  ctx.font = `400 ${W * 0.0322}px ${SANS}`;
  items.forEach((item, i) => ctx.fillText(item, W * 0.952, H * (0.565 + i * 0.071)));
  ctx.restore();
}

// ---------------------------------------------------------------- pièces communes

function wave(ctx, W, H, edge) {
  ctx.beginPath();
  edge(0);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();

  // Fin filet au-dessus de la vague.
  ctx.beginPath();
  edge(-0.021);
  ctx.strokeStyle = RED;
  ctx.lineWidth = H * 0.009;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function fitText(ctx, text, x, y, maxWidth, font, align = 'left') {
  ctx.font = font;
  const width = ctx.measureText(text).width;
  if (width > maxWidth) {
    const size = parseFloat(font.match(/([\d.]+)px/)[1]);
    ctx.font = font.replace(/[\d.]+px/, `${(size * maxWidth) / width}px`);
  }
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function strokeStyle(ctx, lw, color = RED) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Cœur au trait avec un stéthoscope à l'intérieur. s = demi-largeur du cœur.
function heartLogo(ctx, cx, cy, s, lw) {
  ctx.save();
  strokeStyle(ctx, lw);
  ctx.beginPath();
  ctx.moveTo(cx, cy + 0.98 * s);
  ctx.bezierCurveTo(cx - 0.3 * s, cy + 0.72 * s, cx - 1.02 * s, cy + 0.28 * s, cx - 1.02 * s, cy - 0.3 * s);
  ctx.bezierCurveTo(cx - 1.02 * s, cy - 0.86 * s, cx - 0.36 * s, cy - 1.08 * s, cx, cy - 0.58 * s);
  ctx.bezierCurveTo(cx + 0.36 * s, cy - 1.08 * s, cx + 1.02 * s, cy - 0.86 * s, cx + 1.02 * s, cy - 0.3 * s);
  ctx.bezierCurveTo(cx + 1.02 * s, cy + 0.28 * s, cx + 0.3 * s, cy + 0.72 * s, cx, cy + 0.98 * s);
  ctx.closePath();
  ctx.stroke();

  // Stéthoscope : deux branches qui se rejoignent, puis le tube vers le pavillon.
  const j = { x: cx - 0.12 * s, y: cy + 0.32 * s };
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - 0.56 * s, cy - 0.46 * s);
  ctx.bezierCurveTo(cx - 0.66 * s, cy + 0.02 * s, cx - 0.42 * s, cy + 0.32 * s, j.x, j.y);
  ctx.moveTo(cx - 0.02 * s, cy - 0.5 * s);
  ctx.bezierCurveTo(cx + 0.06 * s, cy - 0.04 * s, cx - 0.02 * s, cy + 0.24 * s, j.x, j.y);
  ctx.moveTo(j.x, j.y);
  ctx.bezierCurveTo(j.x - 0.02 * s, cy + 0.74 * s, cx + 0.5 * s, cy + 0.72 * s, cx + 0.5 * s, cy + 0.3 * s);
  ctx.lineTo(cx + 0.5 * s, cy + 0.18 * s);
  ctx.stroke();
  // Embouts auriculaires.
  for (const [ex, ey] of [[cx - 0.56 * s, cy - 0.46 * s], [cx - 0.02 * s, cy - 0.5 * s]]) {
    ctx.beginPath();
    ctx.arc(ex, ey - 0.06 * s, 0.06 * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Pavillon.
  ctx.beginPath();
  ctx.arc(cx + 0.5 * s, cy + 0.05 * s, 0.14 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 0.5 * s, cy + 0.05 * s, 0.05 * s, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.restore();
}

// Caducée stylisé : bâton, ailes, serpent. k = demi-hauteur.
function caduceus(ctx, cx, cy, k, lw) {
  ctx.save();
  strokeStyle(ctx, lw);
  // Bâton et pommeau.
  ctx.beginPath();
  ctx.moveTo(cx, cy - 0.62 * k);
  ctx.lineTo(cx, cy + 1.08 * k);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy - 0.74 * k, 0.11 * k, 0, Math.PI * 2);
  ctx.stroke();
  // Ailes : bord supérieur puis trois plumes.
  for (const sg of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sg * 0.1 * k, cy - 0.5 * k);
    ctx.quadraticCurveTo(cx + sg * 0.62 * k, cy - 0.98 * k, cx + sg * 1.12 * k, cy - 0.78 * k);
    ctx.quadraticCurveTo(cx + sg * 1.02 * k, cy - 0.6 * k, cx + sg * 0.84 * k, cy - 0.56 * k);
    ctx.quadraticCurveTo(cx + sg * 0.8 * k, cy - 0.42 * k, cx + sg * 0.6 * k, cy - 0.4 * k);
    ctx.quadraticCurveTo(cx + sg * 0.52 * k, cy - 0.27 * k, cx + sg * 0.34 * k, cy - 0.28 * k);
    ctx.quadraticCurveTo(cx + sg * 0.22 * k, cy - 0.2 * k, cx + sg * 0.1 * k, cy - 0.26 * k);
    ctx.stroke();
    // Nervures des plumes.
    ctx.beginPath();
    ctx.moveTo(cx + sg * 0.16 * k, cy - 0.44 * k);
    ctx.quadraticCurveTo(cx + sg * 0.55 * k, cy - 0.72 * k, cx + sg * 0.96 * k, cy - 0.7 * k);
    ctx.moveTo(cx + sg * 0.16 * k, cy - 0.36 * k);
    ctx.quadraticCurveTo(cx + sg * 0.45 * k, cy - 0.52 * k, cx + sg * 0.72 * k, cy - 0.49 * k);
    ctx.stroke();
  }
  // Serpent : trait épais rouge puis intérieur blanc pour un rendu au trait.
  const snake = () => {
    ctx.beginPath();
    ctx.moveTo(cx + 0.26 * k, cy - 0.2 * k);
    ctx.bezierCurveTo(cx - 0.05 * k, cy - 0.24 * k, cx - 0.42 * k, cy - 0.04 * k, cx - 0.3 * k, cy + 0.12 * k);
    ctx.bezierCurveTo(cx - 0.16 * k, cy + 0.32 * k, cx + 0.42 * k, cy + 0.28 * k, cx + 0.32 * k, cy + 0.52 * k);
    ctx.bezierCurveTo(cx + 0.24 * k, cy + 0.72 * k, cx - 0.32 * k, cy + 0.66 * k, cx - 0.24 * k, cy + 0.86 * k);
    ctx.quadraticCurveTo(cx - 0.18 * k, cy + 0.98 * k, cx + 0.02 * k, cy + 0.98 * k);
  };
  snake();
  ctx.lineWidth = lw * 2.7;
  ctx.stroke();
  snake();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = lw * 1.05;
  ctx.stroke();
  // Tête.
  ctx.beginPath();
  ctx.ellipse(cx + 0.32 * k, cy - 0.21 * k, 0.12 * k, 0.08 * k, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.restore();
}

// Pictogramme infirmière au trait, dans une boîte de taille s.
function nurseIcon(ctx, x, y, s, lw) {
  const u = s / 100;
  ctx.save();
  ctx.translate(x, y);
  strokeStyle(ctx, lw);
  // Coiffe avec croix.
  ctx.beginPath();
  ctx.moveTo(33 * u, 30 * u);
  ctx.lineTo(35 * u, 15 * u);
  ctx.quadraticCurveTo(50 * u, 8 * u, 65 * u, 15 * u);
  ctx.lineTo(67 * u, 30 * u);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(50 * u, 14 * u);
  ctx.lineTo(50 * u, 25 * u);
  ctx.moveTo(44.5 * u, 19.5 * u);
  ctx.lineTo(55.5 * u, 19.5 * u);
  ctx.stroke();
  // Visage.
  ctx.beginPath();
  ctx.moveTo(35 * u, 31 * u);
  ctx.bezierCurveTo(34 * u, 50 * u, 42 * u, 57 * u, 50 * u, 57 * u);
  ctx.bezierCurveTo(58 * u, 57 * u, 66 * u, 50 * u, 65 * u, 31 * u);
  ctx.stroke();
  // Épaules et col.
  ctx.beginPath();
  ctx.moveTo(18 * u, 100 * u);
  ctx.bezierCurveTo(18 * u, 76 * u, 30 * u, 64 * u, 42 * u, 63 * u);
  ctx.lineTo(50 * u, 74 * u);
  ctx.lineTo(58 * u, 63 * u);
  ctx.bezierCurveTo(70 * u, 64 * u, 82 * u, 76 * u, 82 * u, 100 * u);
  ctx.stroke();
  // Stéthoscope autour du cou.
  ctx.beginPath();
  ctx.moveTo(39 * u, 64 * u);
  ctx.bezierCurveTo(33 * u, 80 * u, 38 * u, 90 * u, 47 * u, 90 * u);
  ctx.bezierCurveTo(60 * u, 90 * u, 64 * u, 82 * u, 63 * u, 74 * u);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64 * u, 70 * u, 4 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Maison et arbres au trait, dans une boîte de largeur s.
function houseIcon(ctx, x, y, s, lw) {
  const u = s / 120;
  ctx.save();
  ctx.translate(x, y);
  strokeStyle(ctx, lw);
  ctx.beginPath();
  // Toit et murs.
  ctx.moveTo(4 * u, 50 * u);
  ctx.lineTo(34 * u, 24 * u);
  ctx.lineTo(64 * u, 50 * u);
  ctx.moveTo(11 * u, 44 * u);
  ctx.lineTo(11 * u, 76 * u);
  ctx.moveTo(57 * u, 44 * u);
  ctx.lineTo(57 * u, 76 * u);
  // Sol.
  ctx.moveTo(0, 76 * u);
  ctx.lineTo(120 * u, 76 * u);
  ctx.stroke();
  // Porte et fenêtres.
  ctx.strokeRect(29 * u, 58 * u, 10 * u, 18 * u);
  ctx.strokeRect(16 * u, 50 * u, 8 * u, 7 * u);
  ctx.strokeRect(44 * u, 50 * u, 8 * u, 7 * u);
  // Arbre rond.
  ctx.beginPath();
  ctx.arc(80 * u, 44 * u, 13 * u, 0, Math.PI * 2);
  ctx.moveTo(80 * u, 57 * u);
  ctx.lineTo(80 * u, 76 * u);
  ctx.stroke();
  // Sapin.
  ctx.beginPath();
  ctx.moveTo(108 * u, 14 * u);
  ctx.lineTo(97 * u, 46 * u);
  ctx.lineTo(102 * u, 46 * u);
  ctx.lineTo(95 * u, 64 * u);
  ctx.lineTo(121 * u, 64 * u);
  ctx.lineTo(114 * u, 46 * u);
  ctx.lineTo(119 * u, 46 * u);
  ctx.closePath();
  ctx.moveTo(108 * u, 64 * u);
  ctx.lineTo(108 * u, 76 * u);
  ctx.stroke();
  ctx.restore();
}

// Combiné de téléphone (tracé « call » de Material Icons, licence Apache 2.0).
const PHONE_PATH =
  'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z';

function phoneIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(PHONE_PATH));
  ctx.restore();
}

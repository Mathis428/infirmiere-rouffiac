// La carte de visite d'Isabelle Buisson en 3D (three.js).
// On la fait tourner au doigt ou à la souris ; relâchée, elle termine son mouvement
// avec un ressort et se pose sur une face. Elle se retourne seule quand la liste
// des soins arrive à l'écran, sauf si la personne vient de la manipuler.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  Shape,
  ShapeGeometry,
  ExtrudeGeometry,
  PlaneGeometry,
  MeshBasicMaterial,
  CanvasTexture,
  SRGBColorSpace,
  NoToneMapping,
  Timer,
  MathUtils,
} from 'three';
import { createFaceCanvas, ensureCardFonts, CARD_RATIO } from './card-art.js';

const CARD_W = 3.4;
const CARD_H = CARD_W / CARD_RATIO;
const THICKNESS = 0.032;
const CORNER = 0.11;
const PI = Math.PI;

// Ressort défini comme chez Apple : amortissement (1 = sans rebond) et temps de réponse en secondes.
class Spring {
  constructor(value, damping, response) {
    this.x = value;
    this.v = 0;
    this.target = value;
    this.k = (2 * PI / response) ** 2;
    this.c = (4 * PI * damping) / response;
  }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * h;
      this.x += this.v * h;
    }
  }
  get settled() {
    return Math.abs(this.x - this.target) < 1e-4 && Math.abs(this.v) < 1e-3;
  }
}

// Résistance progressive au-delà d'une limite (rubber-banding).
function rubber(value, limit) {
  const sign = Math.sign(value);
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  const over = abs - limit;
  return sign * (limit + (over * limit * 0.55) / (limit + 0.55 * over));
}

function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, PI / 2, PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, PI, PI * 1.5, false);
  return s;
}

// Les UV de ShapeGeometry sont en unités de la forme : on les ramène entre 0 et 1.
function normalizeUVs(geometry, w, h) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

export async function mountCard(stage) {
  const host = stage.querySelector('[data-card-canvas]');
  if (!host || !supportsWebGL()) return null;
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  motionQuery.addEventListener?.('change', (e) => { reduced = e.matches; wake(); });

  await ensureCardFonts();

  let renderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Pas de compression des tons : on garde le rouge exact de la carte.
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new Scene();

  const camera = new PerspectiveCamera(24, 1, 0.1, 60);

  // La carte : deux faces imprimées et une tranche de papier.
  const outline = roundedRect(CARD_W, CARD_H, CORNER);
  const faceGeometry = new ShapeGeometry(outline, 16);
  normalizeUVs(faceGeometry, CARD_W, CARD_H);
  const edgeGeometry = new ExtrudeGeometry(outline, { depth: THICKNESS * 0.96, bevelEnabled: false, curveSegments: 16 });
  edgeGeometry.translate(0, 0, -THICKNESS * 0.48);

  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceTexture = (face) => {
    const t = new CanvasTexture(createFaceCanvas(face, 2048));
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = anisotropy;
    return t;
  };
  // Matériau sans éclairage : les couleurs restent exactement celles de la carte imprimée
  // (pas de voile). L'ombrage quand elle tourne est calculé à la main dans la boucle.
  const faceMaterial = (map) => new MeshBasicMaterial({ map, toneMapped: false });

  const card = new Group();
  const front = new Mesh(faceGeometry, faceMaterial(faceTexture('front')));
  front.position.z = THICKNESS / 2;
  const back = new Mesh(faceGeometry, faceMaterial(faceTexture('back')));
  back.rotation.y = PI;
  back.position.z = -THICKNESS / 2;
  const edge = new Mesh(edgeGeometry, new MeshBasicMaterial({ color: 0xe9e7e3, toneMapped: false }));
  card.add(edge, front, back);

  const pivot = new Group();
  pivot.add(card);
  scene.add(pivot);

  const shadow = new Mesh( // taste-skill-ignore: ombre portée de la carte qui flotte réellement dans la scène
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  shadow.position.set(0, -0.2, -1);
  scene.add(shadow);

  // ------------------------------------------------------------ taille
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const t = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const fill = w < 640 ? 0.84 : 0.76;
    const byWidth = CARD_W / (fill * 2 * t * camera.aspect);
    const byHeight = CARD_H / (0.7 * 2 * t);
    camera.position.set(0, 0, Math.max(byWidth, byHeight));
    camera.updateProjectionMatrix();
    wake();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  // ------------------------------------------------------------ mouvement
  const rot = new Spring(0, 0.8, 0.5); // rotation autour de l'axe vertical
  const tilt = new Spring(0, 1, 0.45); // inclinaison avant / arrière
  const lean = new Spring(0, 1, 0.55); // léger suivi de la souris
  let drag = null;
  let lastTouch = -Infinity;

  const radPerPx = () => PI / Math.max(320, host.clientWidth * 0.85);
  const faceIndex = () => Math.round(rot.target / PI);
  const currentFace = () => (Math.abs(faceIndex()) % 2 === 1 ? 'back' : 'front');

  let announced = 'front';
  function announce() {
    const face = currentFace();
    if (face === announced) return;
    announced = face;
    stage.dispatchEvent(new CustomEvent('cardface', { detail: { face } }));
  }

  function flip(direction = 1, source = 'user') {
    if (source === 'user') lastTouch = performance.now();
    rot.target = (faceIndex() + direction) * PI;
    if (reduced) {
      rot.x = rot.target;
      rot.v = 0;
    } else {
      rot.v += direction * 2.2;
    }
    announce();
    wake();
  }

  function showFace(face, source = 'scroll') {
    if (source === 'scroll' && performance.now() - lastTouch < 6000) return;
    if (face !== currentFace()) flip(1, source);
  }

  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    host.setPointerCapture(e.pointerId);
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, r0: rot.x, moved: false, history: [[e.timeStamp, e.clientX]] };
    rot.target = rot.x; // on attrape la carte là où elle est
    rot.v = 0;
    lastTouch = performance.now();
    host.classList.add('is-grabbing');
    wake();
  });

  host.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (drag.moved) {
        rot.x = drag.r0 + dx * radPerPx();
        rot.target = rot.x;
        rot.v = 0;
        if (e.pointerType === 'mouse') tilt.target = rubber(dy * -0.004, 0.3);
      }
      drag.history.push([e.timeStamp, e.clientX]);
      while (drag.history.length > 2 && e.timeStamp - drag.history[0][0] > 100) drag.history.shift();
      wake();
    } else if (e.pointerType === 'mouse' && !reduced) {
      const r = host.getBoundingClientRect();
      lean.target = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.16;
      tilt.target = (((e.clientY - r.top) / r.height) * 2 - 1) * 0.1;
      wake();
    }
  });

  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    host.classList.remove('is-grabbing');
    tilt.target = 0;
    if (!d.moved) {
      flip(1, 'user');
      return;
    }
    const [t0, x0] = d.history[0];
    const [t1, x1] = d.history[d.history.length - 1];
    const velocity = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 * radPerPx() : 0; // rad/s
    // On projette l'élan (comme le défilement iOS) puis on se pose sur la face la plus proche.
    const projected = rot.x + velocity * 0.25;
    rot.target = Math.round(projected / PI) * PI;
    rot.v = reduced ? 0 : velocity;
    if (reduced) rot.x = rot.target;
    lastTouch = performance.now();
    announce();
    wake();
  }
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    host.classList.remove('is-grabbing');
    rot.target = Math.round(rot.x / PI) * PI;
    tilt.target = 0;
    announce();
    wake();
  });
  host.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse' || drag) return;
    lean.target = 0;
    tilt.target = 0;
    wake();
  });

  // ------------------------------------------------------------ boucle
  const timer = new Timer();
  timer.connect(document);
  let running = false;
  let onScreen = true;
  let calmFrames = 0;

  function frame() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 1 / 30);
    const t = timer.getElapsed();
    if (!drag) rot.step(dt);
    tilt.step(dt);
    lean.step(dt);

    const float = reduced ? 0 : Math.sin(t * 1.1) * 0.035;
    card.rotation.y = rot.x + lean.x;
    pivot.rotation.x = tilt.x;
    pivot.rotation.z = reduced ? 0 : Math.sin(t * 0.7) * 0.012;
    pivot.position.y = float;

    const facing = Math.abs(Math.cos(card.rotation.y));
    // Face de profil : un peu plus sombre ; face à nous : couleurs exactes.
    const shade = 0.78 + 0.22 * facing * Math.cos(pivot.rotation.x);
    front.material.color.setScalar(shade);
    back.material.color.setScalar(shade);
    edge.material.color.setRGB(0.91 * (1.1 - 0.25 * facing), 0.906 * (1.1 - 0.25 * facing), 0.89 * (1.1 - 0.25 * facing));
    shadow.scale.set(CARD_W * (0.22 + 0.86 * facing) * 1.08, CARD_H * 1.06, 1);
    shadow.position.y = -0.22 - float * 0.5;
    shadow.material.opacity = 0.42 - float * 1.6;

    renderer.render(scene, camera);

    const calm = !drag && rot.settled && tilt.settled && lean.settled;
    calmFrames = calm && reduced ? calmFrames + 1 : 0;
    if (calmFrames > 3) stop();
  }

  function wake() {
    if (running || !onScreen) return;
    running = true;
    renderer.setAnimationLoop(frame);
  }
  function stop() {
    running = false;
    renderer.setAnimationLoop(null);
  }

  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (onScreen) wake();
    else stop();
  });
  visibility.observe(host);

  resize();
  wake();

  // Petit mouvement d'invite au premier affichage, pour montrer que la carte tourne.
  if (!reduced) {
    setTimeout(() => {
      if (performance.now() - lastTouch > 1500 && !drag) {
        rot.v = 2.6;
        wake();
      }
    }, 1400);
  }

  return {
    flip,
    showFace,
    get face() {
      return currentFace();
    },
  };
}

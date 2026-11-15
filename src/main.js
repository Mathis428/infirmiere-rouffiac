import { CONFIG } from './config.js';
import { initBooking } from './booking.js';
import { initMotion } from './motion.js';

document.documentElement.classList.add('js');

initBooking(document.querySelector('[data-booking]'), CONFIG);
initMotion();
initTopbar(document.querySelector('[data-topbar]'));
initCard(document.querySelector('[data-stage]'));
protectImages(document.querySelectorAll('img[data-no-save]'));

// Portrait : pas de menu « Enregistrer l'image » au clic droit, pas de glisser-déposer.
// Ce n'est qu'un frein : une capture d'écran reste toujours possible.
function protectImages(images) {
  images.forEach((img) => {
    img.addEventListener('contextmenu', (e) => e.preventDefault());
    img.addEventListener('dragstart', (e) => e.preventDefault());
  });
}

// Ombre sous la barre du haut dès qu'on a défilé.
function initTopbar(bar) {
  if (!bar) return;
  const update = () => bar.classList.toggle('is-scrolled', window.scrollY > 4);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

// ------------------------------------------------------------------ carte 3D

function hasWebGL2() {
  try {
    return !!(window.WebGL2RenderingContext && document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

// La 3D ne se charge que lorsque la carte approche de l'écran.
function initCard(stage) {
  if (!stage) return;
  const button = document.querySelector('[data-card-flip]');
  if (!hasWebGL2()) {
    button?.remove();
    return;
  }
  const start = async () => {
    try {
      const { mountCard } = await import('./card3d.js');
      const card = await mountCard(stage);
      if (!card) {
        button?.remove();
        return;
      }
      stage.classList.add('is-3d');
      const label = button?.querySelector('[data-flip-label]');
      stage.addEventListener('cardface', (e) => {
        if (label) label.textContent = e.detail.face === 'back' ? 'Revoir le recto' : 'Retourner la carte';
      });
      button?.addEventListener('click', () => card.flip(1, 'user'));
    } catch (error) {
      console.error(error);
      button?.remove();
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      start();
    },
    { rootMargin: '300px 0px' },
  );
  observer.observe(stage);
}

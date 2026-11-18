// Apparitions discrètes au défilement (GSAP + ScrollTrigger).
// Seulement si la personne n'a pas demandé à réduire les animations ; sinon tout est affiché d'emblée.
// Le contenu reste visible si ce fichier ne se charge pas : seul le script le masque, juste avant de l'animer.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initMotion() {
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    document.querySelectorAll('[data-reveal-group]').forEach((group) => {
      const items = group.querySelectorAll('[data-reveal]');
      if (!items.length) return;
      gsap.from(items, {
        autoAlpha: 0,
        y: 18,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.07,
        scrollTrigger: { trigger: group, start: 'top 90%', once: true },
      });
    });

    // Photos du secteur : posées une à une sur la table.
    const photos = gsap.utils.toArray('[data-collage] li');
    if (photos.length) {
      gsap.from(photos, {
        autoAlpha: 0,
        y: 36,
        duration: 0.6,
        ease: 'power2.out',
        stagger: 0.09,
        scrollTrigger: { trigger: '[data-collage]', start: 'top 85%', once: true },
      });
    }
  });
}

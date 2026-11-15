// Réglages du site. Tout ce qui peut changer est ici.
export const CONFIG = {
  phone: '07 72 19 85 91',
  phoneHref: 'tel:+33772198591',

  // Adresse de l'application Google Apps Script (voir google-agenda/LISEZMOI.md).
  // Vide = mode démonstration : rien n'est envoyé.
  endpoint: '',

  // Réservation en ligne : prises de sang uniquement, dans ces communes.
  communes: ['Saint-Bauzile', 'Balsièges', 'Brenoux', 'Lanuéjols'],

  // Créneaux de départ (heure de Paris) et durée en minutes selon le nombre de personnes.
  slots: ['08:30', '09:00', '09:30'],
  durations: { 1: 30, 2: 45 },

  // Jours ouverts à la réservation : 1 = lundi … 7 = dimanche.
  weekdays: [1, 2, 3, 4, 5, 6],

  // On ne peut plus réserver pour le lendemain après cette heure-là, la veille.
  cutoffHour: 18,

  // Nombre de jours affichés à l'avance.
  daysAhead: 21,
};

// Réglages du site. Ils doivent rester identiques au bloc CONFIG de google-agenda/Code.gs.
export const CONFIG = {
  phone: '07 72 19 85 91',
  phoneHref: 'tel:+33772198591',

  // Adresse de l'application Google Apps Script (voir google-agenda/LISEZMOI.md).
  // Vide = mode démonstration : rien n'est envoyé.
  endpoint: 'https://script.google.com/macros/s/AKfycbxpGtkd54ZWQJ7gp3XR-JJrNj94rnuzCl8MTuLBryZv_V8vmpufCiyWfauHFLEo-1KI/exec',

  // Créneaux en ligne (prise de sang, pansement simple, retrait de points ou d'agrafes,
  // vaccination) : uniquement dans ces communes. Les soins concernés sont marqués
  // « data-slot » dans index.html.
  communes: ['Saint-Bauzile', 'Balsièges', 'Brenoux', 'Lanuéjols'],

  // Heures que les patients peuvent réserver en ligne (créneaux de 30 minutes, heure de Paris).
  bookingTimes: ['07:00', '08:30', '09:00', '09:30', '10:00', '10:30', '17:00', '17:30'],

  // Journée d'Isabelle, de 7 h à 19 h : sert à sa page « Mes rendez-vous » (planning, autre horaire).
  firstStart: '07:00',
  lastStart: '18:30',
  step: 30,

  // Jours des rendez-vous pris en ligne : du lundi au vendredi (1 = lundi … 7 = dimanche).
  weekdays: [1, 2, 3, 4, 5],

  // Jours où l'on peut FAIRE une réservation en ligne : tous les jours.
  bookingDays: [1, 2, 3, 4, 5, 6, 7],

  // On ne peut plus demander de créneau pour le lendemain après cette heure-là, la veille.
  cutoffHour: 18,

  // Nombre de jours affichés à l'avance.
  daysAhead: 21,
};

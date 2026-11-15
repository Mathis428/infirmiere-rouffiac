/**
 * Prise de rendez-vous en ligne · Isabelle Buisson, infirmière à domicile.
 *
 * Ce script relie le site à l'agenda Google d'Isabelle. Il est gratuit et tourne
 * sur les serveurs de Google, avec son compte :
 *  - il donne au site les créneaux libres pour les prises de sang ;
 *  - il inscrit chaque réservation de prise de sang dans l'agenda et prévient Isabelle par e-mail ;
 *  - il transmet par e-mail les demandes pour les autres soins (Isabelle rappelle pour fixer l'heure).
 *
 * Mode d'emploi : LISEZMOI.md, dans le même dossier.
 * Les réglages ci-dessous doivent rester identiques à ceux de src/config.js.
 */

const CONFIG = {
  calendarId: 'primary', // 'primary' = l'agenda principal du compte
  notifyEmail: '', // vide = l'adresse du compte Google qui déploie le script
  communes: ['Saint-Bauzile', 'Balsièges', 'Brenoux', 'Lanuéjols'],
  slots: ['08:30', '09:00', '09:30'],
  durations: { 1: 30, 2: 45 }, // minutes, selon le nombre de personnes
  weekdays: [1, 2, 3, 4, 5, 6], // 1 = lundi … 7 = dimanche
  cutoffHour: 18, // réservation possible jusqu'à la veille à cette heure
  daysAhead: 21,
  keepDays: 90, // les réservations passées sont effacées après ce délai (fonction nettoyer)
};

const CARE_TYPES = [
  'Prise de sang',
  'Injection',
  'Pansement',
  'Soins post-opératoires',
  'Suivi d’une maladie chronique',
  'Soins à une personne âgée ou dépendante',
];
const MOMENTS = ['Matin', 'Après-midi', 'Peu importe'];
const PHONE_RE = /^(?:(?:\+|00)33[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;
const SITE_MARK = 'Réservé sur le site';

// ------------------------------------------------------------------ points d'entrée

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'slots') return json_(listDays_());
  return json_({ ok: true, service: 'rendez-vous' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'format' });
  }
  if (data.website) return json_({ ok: true }); // champ piège rempli : envoi d'un robot, ignoré
  try {
    if (data.action === 'book') return json_(book_(data));
    if (data.action === 'callback') return json_(callback_(data));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
  return json_({ ok: false, error: 'action' });
}

// ------------------------------------------------------------------ créneaux

function listDays_() {
  const now = new Date();
  const first = addDays_(startOfDay_(now), 1);
  const last = addDays_(startOfDay_(now), CONFIG.daysAhead);
  const events = calendar_().getEvents(first, addDays_(last, 1));
  const days = [];
  for (let d = first; d <= last; d = addDays_(d, 1)) {
    if (!isWorkday_(d)) continue;
    const open = isOpen_(d, now);
    days.push({
      date: ymd_(d),
      open: open,
      slots: CONFIG.slots.map((time) => ({
        time: time,
        one: open && isFree_(events, d, time, 1),
        two: open && isFree_(events, d, time, 2),
      })),
    });
  }
  return { ok: true, days: days, cutoffHour: CONFIG.cutoffHour };
}

// Un créneau est libre si aucun événement de l'agenda ne le chevauche
// (un événement « journée entière », comme des congés, bloque toute la journée).
function isFree_(events, day, time, people) {
  const start = at_(day, time);
  const end = new Date(start.getTime() + CONFIG.durations[people] * 60000);
  return !events.some((ev) => ev.getStartTime() < end && ev.getEndTime() > start);
}

// ------------------------------------------------------------------ réservation

function book_(d) {
  const error = checkBooking_(d);
  if (error) return { ok: false, error: error };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const now = new Date();
    const day = parseYmd_(d.date);
    const lastDay = addDays_(startOfDay_(now), CONFIG.daysAhead);
    if (!isWorkday_(day) || !isOpen_(day, now) || day > lastDay) return { ok: false, error: 'closed' };

    const people = Number(d.people) === 2 ? 2 : 1;
    const start = at_(day, d.time);
    const end = new Date(start.getTime() + CONFIG.durations[people] * 60000);
    const cal = calendar_();
    if (cal.getEvents(start, end).length) return { ok: false, error: 'taken' };

    const name = clean_(d.name, 80);
    const address = clean_(d.address, 160);
    const access = clean_(d.access, 160);
    const phone = clean_(d.phone, 20);
    const description = [
      'Téléphone : ' + phone,
      'Adresse : ' + address + ', ' + d.commune,
      access ? 'Pour trouver : ' + access : null,
      'Personnes : ' + people,
      '',
      SITE_MARK + ' le ' + Utilities.formatDate(now, tz_(), "dd/MM/yyyy 'à' HH:mm") + '.',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const event = cal.createEvent('Prise de sang · ' + name + (people === 2 ? ' (2 personnes)' : ''), start, end, {
      location: address + ', ' + d.commune + ', Lozère',
      description: description,
    });
    event.setColor(CalendarApp.EventColor.RED);

    notify_(
      'Nouveau rendez-vous : prise de sang le ' + Utilities.formatDate(start, tz_(), "dd/MM 'à' HH:mm"),
      [
        'Prise de sang à domicile',
        Utilities.formatDate(start, tz_(), "EEEE dd MMMM yyyy 'à' HH:mm") + ' (' + CONFIG.durations[people] + ' min)',
        '',
        'Nom : ' + name,
        description,
        '',
        'Le rendez-vous est déjà dans votre agenda. Pour l’annuler, supprimez-le de l’agenda.',
      ].join('\n'),
    );
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function checkBooking_(d) {
  if (CONFIG.communes.indexOf(d.commune) < 0) return 'commune';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return 'date';
  if (CONFIG.slots.indexOf(d.time) < 0) return 'time';
  return checkContact_(d);
}

function checkContact_(d) {
  if (clean_(d.name, 80).length < 3) return 'name';
  if (!PHONE_RE.test(clean_(d.phone, 20))) return 'phone';
  if (clean_(d.address, 160).length < 4) return 'address';
  if (d.consent !== true) return 'consent';
  return null;
}

// ------------------------------------------------------------------ demande (autres soins)

function callback_(d) {
  const error = checkContact_(d);
  if (error) return { ok: false, error: error };
  const care = CARE_TYPES.indexOf(d.care) >= 0 ? d.care : 'Soin non précisé';
  const commune = CONFIG.communes.indexOf(d.commune) >= 0 ? d.commune : 'Autre commune';
  const moment = MOMENTS.indexOf(d.moment) >= 0 ? d.moment : 'Peu importe';
  const wish = /^\d{4}-\d{2}-\d{2}$/.test(d.wishDate || '')
    ? Utilities.formatDate(parseYmd_(d.wishDate), tz_(), 'EEEE dd/MM/yyyy')
    : 'pas de date précisée';
  notify_('Demande de rendez-vous · ' + care + ' · ' + clean_(d.name, 80), [
    'Soin : ' + care,
    'Commune : ' + commune,
    'Date souhaitée : ' + wish + ' (' + moment.toLowerCase() + ')',
    '',
    'Nom : ' + clean_(d.name, 80),
    'Téléphone : ' + clean_(d.phone, 20),
    'Adresse : ' + clean_(d.address, 160),
    d.access ? 'Pour trouver : ' + clean_(d.access, 160) : null,
    d.message ? 'Message : ' + clean_(d.message, 500) : 'Pas de message.',
    '',
    'Demande reçue le ' + Utilities.formatDate(new Date(), tz_(), "dd/MM/yyyy 'à' HH:mm") + ' sur le site.',
    'Rappelez la personne pour fixer le jour et l’heure, puis supprimez cet e-mail.',
  ].filter((line) => line !== null).join('\n'));
  return { ok: true };
}

// ------------------------------------------------------------------ nettoyage (données personnelles)

// À lancer automatiquement une fois par mois (voir LISEZMOI.md) : efface les réservations
// faites sur le site dont la date est passée depuis plus de CONFIG.keepDays jours.
function nettoyer() {
  const limit = addDays_(startOfDay_(new Date()), -CONFIG.keepDays);
  const from = addDays_(limit, -365);
  calendar_()
    .getEvents(from, limit)
    .filter((ev) => (ev.getDescription() || '').indexOf(SITE_MARK) >= 0)
    .forEach((ev) => ev.deleteEvent());
}

// ------------------------------------------------------------------ outils

function calendar_() {
  return CONFIG.calendarId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.calendarId);
}

function notify_(subject, body) {
  MailApp.sendEmail({
    to: CONFIG.notifyEmail || Session.getEffectiveUser().getEmail(),
    subject: subject,
    body: body,
    name: 'Site · rendez-vous',
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max);
}

function tz_() {
  return Session.getScriptTimeZone();
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays_(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

function at_(day, time) {
  const parts = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), parts[0], parts[1]);
}

function parseYmd_(s) {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function ymd_(d) {
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function isWorkday_(d) {
  const iso = d.getDay() === 0 ? 7 : d.getDay();
  return CONFIG.weekdays.indexOf(iso) >= 0;
}

// Pour le jour J, la réservation ferme la veille à CONFIG.cutoffHour heures.
function isOpen_(day, now) {
  const cutoff = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, CONFIG.cutoffHour, 0);
  return now < cutoff;
}

// Petit test à lancer depuis l'éditeur (bouton « Exécuter ») : affiche les créneaux dans le journal.
function tester() {
  console.log(JSON.stringify(listDays_(), null, 2));
}

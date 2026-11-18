/**
 * Prise de rendez-vous en ligne · Isabelle Buisson, infirmière à domicile.
 *
 * Gratuit, tourne sur les serveurs de Google avec le compte d'Isabelle :
 *  - donne au site les créneaux libres de 30 minutes pour les soins réservables
 *    en ligne (prise de sang, pansement simple, retrait de points ou d'agrafes,
 *    vaccination), en tenant compte des autres rendez-vous de l'agenda ;
 *  - enregistre chaque demande dans un tableau Google Sheets « Rendez-vous du site »
 *    et bloque l'horaire demandé dans l'agenda (événement gris « À confirmer ») ;
 *  - envoie à Isabelle un e-mail avec un lien vers une page où elle VALIDE,
 *    REFUSE ou PROPOSE UN AUTRE HORAIRE ;
 *  - prévient le patient par e-mail (s'il en a donné un), et par SMS si un
 *    service SMS est configuré ;
 *  - envoie un rappel la veille du rendez-vous.
 *
 * Mode d'emploi : LISEZMOI.md, dans le même dossier.
 * Les réglages communs doivent rester identiques à ceux de src/config.js.
 */

const CONFIG = {
  // Agenda où le site crée les rendez-vous : l'agenda « boulot » d'Isabelle.
  // ('primary' = l'agenda principal du compte.)
  calendarId: 'f462b068e48c86458b88d49ca88db0ff08f224cf4b662e68650bf0b30eead4cd@group.calendar.google.com',
  // Agendas seulement LUS pour savoir quand elle est occupée : rien n'y est jamais écrit.
  // 'primary' = son agenda principal, privé. Seuls les événements avec une heure y bloquent
  // un créneau ; les événements « journée entière » (anniversaires, rappels) sont ignorés.
  // Mettre [] pour ne tenir compte que de l'agenda boulot.
  busyCalendars: ['primary'],
  notifyEmail: '', // vide = l'adresse du compte Google qui déploie le script
  communes: ['Saint-Bauzile', 'Balsièges', 'Brenoux', 'Lanuéjols'],

  // Heures que les patients peuvent réserver en ligne (heure de Paris), et uniquement celles-là.
  bookingTimes: ['07:00', '08:30', '09:00', '09:30', '10:00', '10:30', '17:00', '17:30'],

  // Journée d'Isabelle (7 h → 19 h, toutes les 30 min) : sert à « Mes rendez-vous » quand elle
  // propose ou déplace un horaire elle-même. Les patients, eux, ne voient que bookingTimes.
  firstStart: '07:00',
  lastStart: '18:30',
  step: 30, // minutes entre deux heures de début
  duration: 30, // minutes par rendez-vous, trajet compris

  // Temps de trajet ajouté entre deux rendez-vous (minutes). À 0 : les 30 minutes
  // du créneau comprennent déjà le trajet (choix d'Isabelle). Mettre par exemple 15
  // dans « other » pour ajouter un trajet entre deux communes différentes.
  travel: {
    same: 0, // même commune
    other: 0, // deux communes différentes du secteur
    unknown: 0, // événement de l'agenda dont on ne connaît pas la commune
  },

  weekdays: [1, 2, 3, 4, 5], // jours des rendez-vous pris en ligne : du lundi au vendredi (1 = lundi … 7 = dimanche)
  bookingDays: [1, 2, 3, 4, 5, 6, 7], // jours où l'on peut faire la réservation en ligne : tous les jours
  cutoffHour: 18, // demande possible jusqu'à la veille à cette heure
  daysAhead: 21,
  reminderHour: 17, // heure d'envoi des rappels, la veille du rendez-vous
  keepDays: 90, // les demandes sont effacées après ce délai (fonction nettoyer)
  smsSender: 'IBuisson', // nom d'expéditeur des SMS (11 caractères max, sans espace)
  adminUrl: 'https://cabinet-infirmier-rouffiac.fr/rdv/', // page « Mes rendez-vous » d'Isabelle
};

// Soins réservables en ligne sur un créneau (les mêmes que « data-slot » dans index.html).
const SLOT_CARES = ['Prise de sang', 'Pansement simple', 'Retrait de points ou d’agrafes', 'Vaccination'];
// Soins demandés par formulaire : Isabelle rappelle pour fixer le rendez-vous.
const CARE_TYPES = SLOT_CARES.concat([
  'Injection',
  'Soins à une personne âgée ou dépendante',
  'Pansement complexe',
  'Soins post-opératoires',
  'Suivi d’une maladie chronique',
  'Autre soin',
]);
const MOMENTS = ['Matin', 'Après-midi', 'Peu importe'];
const PHONE_RE = /^(?:(?:\+|00)33[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DISPLAY = '07 72 19 85 91';
const COLUMNS = [
  'ID', 'Reçue le', 'Statut', 'Soin', 'Commune', 'Nom', 'Téléphone', 'E-mail', 'Adresse',
  'Pour trouver', 'Personnes', 'Date souhaitée', 'Moment', 'Message', 'Rendez-vous', 'Durée', 'Événement', 'Rappel envoyé',
];
const STATUS = {
  pending: 'En attente',
  proposed: 'Horaire proposé',
  confirmed: 'Confirmé',
  refused: 'Refusé',
  declined: 'Refusé par le patient',
  cancelled: 'Annulé',
};
// Statuts où une demande attend encore une décision (valider ou refuser).
const OPEN_ = [STATUS.pending, STATUS.proposed];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

// ------------------------------------------------------------------ installation

// À lancer une fois depuis l'éditeur (bouton « Exécuter ») : crée le tableau,
// la clé de sécurité des liens et les tâches automatiques (rappels, nettoyage).
function installer() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SECRET')) props.setProperty('SECRET', Utilities.getUuid() + Utilities.getUuid());
  sheet_();
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('envoyerRappels').timeBased().everyDays(1).atHour(CONFIG.reminderHour).create();
  ScriptApp.newTrigger('nettoyer').timeBased().onMonthDay(1).atHour(3).create();
  console.log('Installation terminée. Tableau : ' + SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getUrl());
}

// ------------------------------------------------------------------ points d'entrée web

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'slots') return json_(listDays_(p.commune));
  if (p.action === 'gerer') return page_(nursePage_(p.id, p.sig), 'Demande de rendez-vous');
  if (p.action === 'reponse') return page_(patientPage_(p.id, p.sig), 'Votre rendez-vous');
  return json_({ ok: true, service: 'rendez-vous' });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'format' });
  }
  if (data.website) return json_({ ok: true }); // champ piège rempli : robot, ignoré
  const writes = ['book', 'callback', 'admin.login', 'admin.decide', 'admin.settings'];
  return json_(writes.indexOf(data.action) >= 0 ? once_(data.key, () => route_(data)) : route_(data));
}

function route_(data) {
  try {
    if (String(data.action || '').indexOf('admin.') === 0) return admin_(data);
    if (data.action === 'book') return book_(data);
    if (data.action === 'callback') return request_(data);
  } catch (err) {
    console.error(err);
    return { ok: false, error: 'server' };
  }
  return { ok: false, error: 'action' };
}

// Quand Google tarde à répondre, le navigateur renvoie la même demande avec la même clé :
// on rend alors la réponse déjà faite au lieu de la traiter deux fois (deux réservations,
// deux e-mails, deux essais de code…).
function once_(key, run) {
  key = String(key || '').replace(/[^\w-]/g, '').slice(0, 64);
  if (!key) return run();
  const cache = CacheService.getScriptCache();
  const id = 'once:' + key;
  for (let i = 0; i < 25; i++) {
    const prev = cache.get(id);
    if (!prev) break;
    if (prev !== 'en cours') return JSON.parse(prev);
    Utilities.sleep(1000); // la première demande est encore en train d'être traitée
  }
  cache.put(id, 'en cours', 120);
  const result = run();
  try {
    cache.put(id, JSON.stringify(result), 600);
  } catch (err) {
    cache.remove(id);
  }
  return result;
}

// ------------------------------------------------------------------ horaires libres (trajets compris)

function listDays_(commune) {
  const now = new Date();
  if (!canBookNow_(now)) return { ok: true, days: [], closed: 'weekend' };
  const first = addDays_(startOfDay_(now), 1);
  const last = addDays_(startOfDay_(now), CONFIG.daysAhead);
  const blocks = blocks_(first, addDays_(last, 1));
  const knownCommune = CONFIG.communes.indexOf(commune) >= 0 ? commune : null;
  const bookable = bookingTimes_();
  const days = [];
  for (let d = first; d <= last; d = addDays_(d, 1)) {
    if (!isWorkday_(d)) continue;
    const open = isOpen_(d, now) && !!knownCommune;
    const times = open
      ? bookable.filter((t) => fits_(blocks, at_(d, t), CONFIG.duration, knownCommune, null))
      : [];
    days.push({ date: ymd_(d), open: open, times: times });
  }
  return { ok: true, days: days };
}

// Événements de l'agenda sur une période, avec leur commune si on la connaît.
// L'agenda boulot compte en entier ; les agendas de busyCalendars, seulement leurs événements avec une heure.
function blocks_(from, to) {
  const block = (ev) => ({
    id: ev.getId(),
    start: ev.getStartTime(),
    end: ev.getEndTime(),
    allDay: ev.isAllDayEvent(),
    commune: communeOf_(ev),
  });
  const work = calendar_();
  const list = work.getEvents(from, to).map(block);
  (CONFIG.busyCalendars || []).forEach((id) => {
    const cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal || cal.getId() === work.getId()) return;
    cal.getEvents(from, to).forEach((ev) => {
      if (!ev.isAllDayEvent()) list.push(block(ev));
    });
  });
  return list;
}

function communeOf_(ev) {
  const tag = ev.getTag('commune');
  if (tag) return tag;
  const text = (ev.getLocation() || '') + ' ' + ev.getTitle();
  return CONFIG.communes.filter((c) => text.indexOf(c) >= 0)[0] || null;
}

function travel_(a, b) {
  if (!a || !b) return CONFIG.travel.unknown;
  return a === b ? CONFIG.travel.same : CONFIG.travel.other;
}

// Un rendez-vous tient s'il reste, avant et après chaque autre événement, le temps de trajet.
// Un événement « journée entière » (congés…) bloque toute la journée.
function fits_(blocks, start, minutes, commune, ignoreId) {
  const s = start.getTime();
  const e = s + minutes * 60000;
  return blocks.every((b) => {
    if (ignoreId && b.id === ignoreId) return true;
    if (b.allDay) return !(b.start.getTime() < e && b.end.getTime() > s);
    const gap = travel_(b.commune, commune) * 60000;
    return e + gap <= b.start.getTime() || b.end.getTime() + gap <= s;
  });
}

// ------------------------------------------------------------------ demandes venant du site

// Soin réservable en ligne, sur un créneau choisi : il est bloqué en attendant la validation.
function book_(d) {
  const error = checkContact_(d) || checkSlot_(d);
  if (error) return { ok: false, error: error };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const now = new Date();
    if (!canBookNow_(now)) return { ok: false, error: 'weekend' };
    const day = parseYmd_(d.date);
    if (!isWorkday_(day) || !isOpen_(day, now) || day > addDays_(startOfDay_(now), CONFIG.daysAhead)) {
      return { ok: false, error: 'closed' };
    }
    const minutes = CONFIG.duration;
    const start = at_(day, d.time);
    const end = new Date(start.getTime() + minutes * 60000);
    if (!fits_(blocks_(addDays_(start, -1), addDays_(end, 1)), start, minutes, d.commune, null)) {
      return { ok: false, error: 'taken' };
    }
    const r = newRecord_(d, { care: d.care, appointment: start, minutes: minutes });
    r.message = clean_(d.message, 500);
    const ev = calendar_().createEvent(eventTitle_(r, STATUS.pending), start, end, {
      location: r.address + ', ' + r.commune + ', Lozère',
      description: eventDescription_(r),
    });
    ev.setColor(CalendarApp.EventColor.GRAY);
    ev.setTag('requestId', r.id);
    ev.setTag('commune', r.commune);
    r.eventId = ev.getId();
    saveRecord_(r);
    const subject = 'Nouvelle demande : ' + r.care.toLowerCase() + ' le ' + longDate_(start) + ' à ' + time_(start);
    if (autoConfirm_()) {
      confirm_(r, '');
      notifyNurse_(r, subject + ' (confirmée automatiquement)');
    } else {
      notifyNurse_(r, subject);
      ackPatient_(r);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Autre soin (ou autre commune) : Isabelle proposera un horaire.
function request_(d) {
  const error = checkContact_(d);
  if (error) return { ok: false, error: error };
  const r = newRecord_(d, { care: CARE_TYPES.indexOf(d.care) >= 0 ? d.care : 'Autre soin' });
  r.wishDate = /^\d{4}-\d{2}-\d{2}$/.test(d.wishDate || '') ? d.wishDate : '';
  r.moment = MOMENTS.indexOf(d.moment) >= 0 ? d.moment : 'Peu importe';
  r.message = clean_(d.message, 500);
  saveRecord_(r);
  notifyNurse_(r, 'Nouvelle demande : ' + r.care.toLowerCase() + ' · ' + r.name);
  ackPatient_(r);
  return { ok: true };
}

function checkSlot_(d) {
  if (SLOT_CARES.indexOf(d.care) < 0) return 'care';
  if (CONFIG.communes.indexOf(d.commune) < 0) return 'commune';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '')) return 'date';
  if (bookingTimes_().indexOf(d.time) < 0) return 'time';
  return null;
}

function checkContact_(d) {
  if (clean_(d.name, 80).length < 3) return 'name';
  if (!PHONE_RE.test(clean_(d.phone, 20))) return 'phone';
  if (d.email && !EMAIL_RE.test(clean_(d.email, 120))) return 'email';
  if (clean_(d.address, 160).length < 4) return 'address';
  if (d.consent !== true) return 'consent';
  return null;
}

function newRecord_(d, extra) {
  return {
    id: Utilities.getUuid(),
    received: new Date(),
    status: STATUS.pending,
    care: extra.care,
    commune: CONFIG.communes.indexOf(d.commune) >= 0 ? d.commune : 'Autre commune',
    name: clean_(d.name, 80),
    phone: clean_(d.phone, 20),
    email: clean_(d.email, 120),
    address: clean_(d.address, 160),
    access: clean_(d.access, 160),
    people: 1,
    wishDate: '',
    moment: '',
    message: '',
    appointment: extra.appointment || null,
    minutes: extra.minutes || '',
    eventId: '',
    reminded: '',
  };
}

// ------------------------------------------------------------------ page de gestion (Isabelle)

function nursePage_(id, sig) {
  if (!checkSig_(id, 'nurse', sig)) return '<p>Lien invalide.</p>';
  const r = findRecord_(id);
  if (!r) return '<p>Cette demande n’existe plus (elle a peut-être été effacée).</p>';
  const when = r.appointment ? longDate_(r.appointment) + ' à ' + time_(r.appointment) : null;
  const tomorrow = ymd_(addDays_(startOfDay_(new Date()), 1));
  const defaultDate = r.appointment ? ymd_(r.appointment) : r.wishDate || tomorrow;
  const defaultTime = r.appointment ? hhmm_(r.appointment) : '09:00';
  const durationOptions = [15, 20, 30, 45, 60, 90]
    .map((m) => '<option' + (Number(r.minutes || CONFIG.duration) === m ? ' selected' : '') + '>' + m + '</option>')
    .join('');
  const contact = r.email
    ? 'Le patient sera prévenu par e-mail (' + esc_(r.email) + ')' + (smsEnabled_() && isMobile_(r.phone) ? ' et par SMS' : '') + '.'
    : 'Pas d’e-mail : ' + (smsEnabled_() && isMobile_(r.phone) ? 'le patient sera prévenu par SMS.' : 'appelez le patient au ' + esc_(r.phone) + '.');

  return (
    '<h1>' + esc_(r.care) + '</h1>' +
    '<p class="status">Statut : <strong>' + esc_(r.status) + '</strong></p>' +
    '<dl>' +
    row_('Patient', r.name) + row_('Téléphone', '<a href="tel:' + esc_(r.phone.replace(/[^\d+]/g, '')) + '">' + esc_(r.phone) + '</a>', true) +
    row_('E-mail', r.email || '—') + row_('Adresse', r.address + ', ' + r.commune) + row_('Pour trouver', r.access || '—') +
    (when ? row_('Horaire demandé', when + ' (' + r.minutes + ' min)') : row_('Souhait', (r.wishDate ? longDate_(parseYmd_(r.wishDate)) : 'pas de date') + ', ' + (r.moment || 'peu importe').toLowerCase())) +
    (r.message ? row_('Message', r.message) : '') +
    '</dl>' +
    '<p class="note">' + contact + '</p>' +
    (OPEN_.indexOf(r.status) < 0
      ? '<p class="note">Cette demande est déjà traitée. Vous pouvez encore proposer un nouvel horaire.</p>'
      : '') +
    (when && OPEN_.indexOf(r.status) >= 0
      ? '<section><h2>Valider</h2><button onclick="send(\'valider\')">Valider ce rendez-vous</button></section>'
      : '') +
    '<section><h2>' + (when ? 'Proposer un autre horaire' : 'Proposer un horaire') + '</h2>' +
    '<label>Jour <input type="date" id="date" value="' + defaultDate + '"></label>' +
    '<label>Heure <input type="time" id="time" step="300" value="' + defaultTime + '"></label>' +
    '<label>Durée (min) <select id="minutes">' + durationOptions + '</select></label>' +
    '<label class="check"><input type="checkbox" id="agreed"> Déjà convenu avec le patient (confirmer directement)</label>' +
    '<label>Message pour le patient (facultatif) <textarea id="propose-msg" rows="2"></textarea></label>' +
    '<button onclick="send(\'proposer\')">Proposer cet horaire</button></section>' +
    (OPEN_.indexOf(r.status) >= 0
      ? '<section><h2>Refuser</h2>' +
        '<label>Message pour le patient (facultatif) <textarea id="refuse-msg" rows="2"></textarea></label>' +
        '<button class="secondary" onclick="send(\'refuser\')">Refuser la demande</button></section>'
      : '<textarea id="refuse-msg" hidden></textarea>') +
    '<p id="result" role="status"></p>' +
    '<script>' +
    'function send(choice){var b=document.querySelectorAll("button");b.forEach(function(x){x.disabled=true});' +
    'var p={choice:choice,date:document.getElementById("date").value,time:document.getElementById("time").value,' +
    'minutes:Number(document.getElementById("minutes").value),agreed:document.getElementById("agreed").checked,' +
    'message:choice==="refuser"?document.getElementById("refuse-msg").value:document.getElementById("propose-msg").value};' +
    'google.script.run.withSuccessHandler(function(m){document.getElementById("result").textContent=m;b.forEach(function(x){x.disabled=false})})' +
    '.withFailureHandler(function(e){document.getElementById("result").textContent="Erreur : "+e.message;b.forEach(function(x){x.disabled=false})})' +
    '.decider(' + JSON.stringify(id) + ',' + JSON.stringify(sig) + ',p);}' +
    '</script>'
  );
}

// Appelée par la page de gestion. Nom sans « _ » pour pouvoir être appelée depuis la page.
function decider(id, sig, p) {
  if (!checkSig_(id, 'nurse', sig)) throw new Error('lien invalide');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findRecord_(id);
    if (!r) throw new Error('demande introuvable');
    return decide_(r, p);
  } finally {
    lock.releaseLock();
  }
}

// Valider, refuser, annuler ou proposer un horaire. Renvoie une phrase pour Isabelle.
// Utilisée par la page « Mes rendez-vous » et par l'ancienne page (lien signé).
function decide_(r, p) {
  {
    const message = clean_(p.message, 500);

    // Les deux pages (« Mes rendez-vous » et l'ancien lien) peuvent agir sur la même demande :
    // on vérifie toujours le statut actuel avant d'agir.
    const done = 'cette demande est déjà traitée (statut : ' + r.status + ')';
    if ((p.choice === 'valider' || p.choice === 'refuser') && OPEN_.indexOf(r.status) < 0) throw new Error(done);
    if (p.choice === 'annuler' && [STATUS.confirmed, STATUS.proposed].indexOf(r.status) < 0) throw new Error(done);

    if (p.choice === 'annuler') {
      if (!r.appointment) throw new Error('aucun rendez-vous à annuler');
      const when = longDate_(r.appointment) + ' à ' + time_(r.appointment);
      deleteEvent_(r);
      r.status = STATUS.cancelled;
      saveRecord_(r);
      tellPatient_(
        r,
        'Rendez-vous annulé : ' + when,
        'Je dois malheureusement annuler mon passage du ' + when + ' (' + r.care.toLowerCase() + ').' +
          (message ? '\n\n' + message : '') +
          '\n\nAppelez-moi au ' + PHONE_DISPLAY + ' pour convenir d’un autre moment.',
        'Isabelle Buisson, infirmière : je dois annuler le RDV du ' + shortDate_(r.appointment) + '. Appelez-moi au ' + PHONE_DISPLAY + '.',
      );
      return 'Rendez-vous annulé. ' + informed_(r);
    }

    if (p.choice === 'valider') {
      if (!r.appointment) throw new Error('aucun horaire à valider : proposez-en un');
      confirm_(r, message);
      return 'Rendez-vous confirmé le ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) + '. ' + informed_(r);
    }

    if (p.choice === 'refuser') {
      deleteEvent_(r);
      r.status = STATUS.refused;
      saveRecord_(r);
      tellPatient_(
        r,
        'Votre demande de rendez-vous',
        'Je ne peux malheureusement pas donner suite à votre demande (' + r.care.toLowerCase() + ').' +
          (message ? '\n\n' + message : '') +
          '\n\nPour en parler, appelez-moi au ' + PHONE_DISPLAY + '.',
        'Isabelle Buisson, infirmière : je ne peux pas donner suite à votre demande de rendez-vous. Appelez-moi au ' + PHONE_DISPLAY + '.',
      );
      return 'Demande refusée. ' + informed_(r);
    }

    if (p.choice === 'proposer') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '') || !/^\d{2}:\d{2}$/.test(p.time || '')) throw new Error('jour ou heure manquant');
      const minutes = Math.max(5, Math.min(240, Number(p.minutes) || 30));
      const start = at_(parseYmd_(p.date), p.time);
      const end = new Date(start.getTime() + minutes * 60000);
      const commune = CONFIG.communes.indexOf(r.commune) >= 0 ? r.commune : null;
      if (!fits_(blocks_(addDays_(start, -1), addDays_(end, 1)), start, minutes, commune, r.eventId || null)) {
        throw new Error('cet horaire chevauche un autre rendez-vous (trajet compris)');
      }
      r.appointment = start;
      r.minutes = minutes;
      let ev = r.eventId ? eventById_(r.eventId) : null;
      if (ev) {
        ev.setTime(start, end);
      } else {
        ev = calendar_().createEvent(eventTitle_(r, STATUS.proposed), start, end, {
          location: r.address + ', ' + r.commune + ', Lozère',
          description: eventDescription_(r),
        });
        ev.setTag('requestId', r.id);
        if (commune) ev.setTag('commune', commune);
        r.eventId = ev.getId();
      }
      if (p.agreed) {
        confirm_(r, message);
        return 'Rendez-vous confirmé le ' + longDate_(start) + ' à ' + time_(start) + '. ' + informed_(r);
      }
      r.status = STATUS.proposed;
      r.reminded = '';
      ev.setTitle(eventTitle_(r, STATUS.proposed));
      ev.setColor(CalendarApp.EventColor.GRAY);
      saveRecord_(r);
      const link = webUrl_() + '?action=reponse&id=' + encodeURIComponent(r.id) + '&sig=' + sig_(r.id, 'patient');
      tellPatient_(
        r,
        'Proposition de rendez-vous le ' + longDate_(start) + ' à ' + time_(start),
        'Je vous propose de passer le ' + longDate_(start) + ' à ' + time_(start) + ' (' + r.care.toLowerCase() + ').' +
          (message ? '\n\n' + message : '') +
          '\n\nPour accepter ou refuser cet horaire : ' + link +
          '\n\nVous pouvez aussi m’appeler au ' + PHONE_DISPLAY + '.',
        'Isabelle Buisson, infirmière : je vous propose le ' + shortDate_(start) + ' à ' + time_(start) + '. Merci de me confirmer au ' + PHONE_DISPLAY + '.',
      );
      return 'Horaire proposé le ' + longDate_(start) + ' à ' + time_(start) + '. ' +
        (r.email ? 'Le patient a reçu un lien pour accepter ou refuser.' : 'Pas d’e-mail : appelez le patient, puis revenez cocher « Déjà convenu ».');
    }
    throw new Error('choix inconnu');
  }
}

function confirm_(r, message) {
  let ev = eventById_(r.eventId);
  if (!ev && r.appointment) {
    // L'événement a été supprimé à la main dans l'agenda : on le recrée, si l'horaire est toujours libre.
    const start = r.appointment;
    const minutes = Number(r.minutes) || CONFIG.duration;
    const end = new Date(start.getTime() + minutes * 60000);
    const commune = CONFIG.communes.indexOf(r.commune) >= 0 ? r.commune : null;
    if (!fits_(blocks_(addDays_(start, -1), addDays_(end, 1)), start, minutes, commune, null)) {
      throw new Error('l’horaire n’est plus libre dans l’agenda : proposez-en un autre');
    }
    ev = calendar_().createEvent(eventTitle_(r, STATUS.confirmed), start, end, {
      location: r.address + ', ' + r.commune + ', Lozère',
      description: eventDescription_(r),
    });
    ev.setTag('requestId', r.id);
    if (commune) ev.setTag('commune', commune);
    r.eventId = ev.getId();
  }
  if (ev) {
    ev.setTitle(eventTitle_(r, STATUS.confirmed));
    ev.setColor(CalendarApp.EventColor.RED);
  }
  r.status = STATUS.confirmed;
  r.reminded = '';
  saveRecord_(r);
  tellPatient_(
    r,
    'Rendez-vous confirmé le ' + longDate_(r.appointment) + ' à ' + time_(r.appointment),
    'Je vous confirme mon passage le ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) +
      ', ' + r.address + ', ' + r.commune + ' (' + r.care.toLowerCase() + ').' +
      (message ? '\n\n' + message : '') +
      (r.care === 'Prise de sang'
        ? '\n\nÀ préparer : l’ordonnance, votre carte Vitale, votre carte de mutuelle et, si le laboratoire vous les a remis, le kit ou les étiquettes. Restez à jeun si l’ordonnance le précise ou en cas de doute.'
        : '\n\nPensez à préparer votre ordonnance et votre carte Vitale.') +
      '\n\nVous recevrez un rappel la veille. Pour annuler ou déplacer : ' + PHONE_DISPLAY + '.',
    'Isabelle Buisson, infirmière : RDV confirmé le ' + shortDate_(r.appointment) + ' à ' + time_(r.appointment) + '. Pour annuler : ' + PHONE_DISPLAY + '.',
  );
}

function informed_(r) {
  if (r.email) return 'Le patient a été prévenu par e-mail.';
  if (smsEnabled_() && isMobile_(r.phone)) return 'Le patient a été prévenu par SMS.';
  return 'Pas d’e-mail : pensez à appeler le patient au ' + r.phone + '.';
}

// ------------------------------------------------------------------ réponse du patient à une proposition

function patientPage_(id, sig) {
  if (!checkSig_(id, 'patient', sig)) return '<p>Lien invalide.</p>';
  const r = findRecord_(id);
  if (!r || !r.appointment) return '<p>Ce rendez-vous n’existe plus. Appelez le ' + PHONE_DISPLAY + '.</p>';
  if (r.status !== STATUS.proposed) {
    return '<h1>Votre rendez-vous</h1><p>Statut : <strong>' + esc_(r.status) + '</strong>.</p><p>Pour toute question : ' + PHONE_DISPLAY + '.</p>';
  }
  return (
    '<h1>Proposition de rendez-vous</h1>' +
    '<p>Isabelle Buisson, infirmière, vous propose de passer le <strong>' + longDate_(r.appointment) + ' à ' + time_(r.appointment) + '</strong>, ' +
    esc_(r.address) + ', ' + esc_(r.commune) + '.</p>' +
    '<button onclick="send(true)">J’accepte cet horaire</button> ' +
    '<button class="secondary" onclick="send(false)">Cet horaire ne me convient pas</button>' +
    '<p id="result" role="status"></p>' +
    '<script>function send(ok){var b=document.querySelectorAll("button");b.forEach(function(x){x.disabled=true});' +
    'google.script.run.withSuccessHandler(function(m){document.getElementById("result").textContent=m})' +
    '.withFailureHandler(function(e){document.getElementById("result").textContent="Erreur : "+e.message;b.forEach(function(x){x.disabled=false})})' +
    '.repondre(' + JSON.stringify(id) + ',' + JSON.stringify(sig) + ',ok);}</script>'
  );
}

function repondre(id, sig, accepted) {
  if (!checkSig_(id, 'patient', sig)) throw new Error('lien invalide');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findRecord_(id);
    if (!r || r.status !== STATUS.proposed) return 'Cette proposition n’est plus valable. Appelez le ' + PHONE_DISPLAY + '.';
    if (accepted) {
      confirm_(r, '');
      notify_('Proposition acceptée : ' + r.name + ', ' + longDate_(r.appointment) + ' à ' + time_(r.appointment),
        r.name + ' a accepté le rendez-vous du ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) + '. Il est confirmé dans votre agenda.');
      return 'Merci, le rendez-vous est confirmé. Vous recevrez un rappel la veille.';
    }
    deleteEvent_(r);
    r.status = STATUS.declined;
    saveRecord_(r);
    notify_('Proposition refusée : ' + r.name,
      r.name + ' (' + r.phone + ') n’a pas accepté l’horaire proposé. Le créneau est libéré. Rappelez-le pour convenir d’un autre moment.');
    return 'C’est noté. Isabelle Buisson va vous rappeler pour convenir d’un autre moment.';
  } finally {
    lock.releaseLock();
  }
}

// ------------------------------------------------------------------ rappels de la veille

// Lancée chaque jour à CONFIG.reminderHour par le déclencheur créé par installer().
function envoyerRappels() {
  const tomorrow = ymd_(addDays_(startOfDay_(new Date()), 1));
  allRecords_()
    .filter((r) => r.status === STATUS.confirmed && r.appointment && ymd_(r.appointment) === tomorrow && !r.reminded)
    .forEach((r) => {
      const sent = tellPatient_(
        r,
        'Rappel : rendez-vous demain à ' + time_(r.appointment),
        'Je vous rappelle mon passage demain, ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) +
          ', ' + r.address + ', ' + r.commune + '.' +
          (r.care === 'Prise de sang' ? '\n\nN’oubliez pas l’ordonnance, la carte Vitale, la carte de mutuelle, et de rester à jeun si l’ordonnance le précise ou en cas de doute.' : '') +
          '\n\nEn cas d’empêchement : ' + PHONE_DISPLAY + '.',
        'Rappel : Isabelle Buisson, infirmière, passe demain à ' + time_(r.appointment) + '. Empêchement : ' + PHONE_DISPLAY + '.',
      );
      if (sent) {
        r.reminded = new Date();
        saveRecord_(r);
      }
    });
}

// ------------------------------------------------------------------ nettoyage (données personnelles)

// Lancée chaque mois : efface les demandes et les événements créés par le site
// dont la date est passée depuis plus de CONFIG.keepDays jours.
function nettoyer() {
  const limit = addDays_(startOfDay_(new Date()), -CONFIG.keepDays);
  const sh = sheet_();
  const values = sh.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    const r = toRecord_(values[i]);
    const ref = r.appointment || r.received;
    if (ref && ref < limit) {
      deleteEvent_(r);
      sh.deleteRow(i + 1);
    }
  }
}

// ------------------------------------------------------------------ « Mes rendez-vous » (page d'Isabelle)

// Le code d'accès se règle dans l'éditeur : Paramètres du projet → Propriétés du script →
// CODE_GESTION. Changer ce code déconnecte tous les téléphones.
function admin_(d) {
  try {
    if (d.action === 'admin.login') return adminLogin_(d.code);
    if (!adminTokenOk_(d.token)) return { ok: false, error: 'auth' };
    if (d.action === 'admin.list') {
      return {
        ok: true,
        items: allRecords_().map(publicRecord_),
        autoConfirm: autoConfirm_(),
        bookingTimes: bookingTimes_(),
        now: new Date().toISOString(),
      };
    }
    if (d.action === 'admin.slots') {
      return { ok: true, times: freeTimesOn_(d.date, d.commune, d.ignoreId, Number(d.minutes) || CONFIG.duration) };
    }
    if (d.action === 'admin.settings') {
      const props = PropertiesService.getScriptProperties();
      if (typeof d.autoConfirm === 'boolean') props.setProperty('AUTO_CONFIRM', d.autoConfirm ? 'oui' : 'non');
      if (Array.isArray(d.bookingTimes)) {
        const grid = gridTimes_();
        const times = grid.filter((t) => d.bookingTimes.indexOf(t) >= 0); // seulement des heures de sa journée, dans l'ordre
        props.setProperty('BOOKING_TIMES', JSON.stringify(times));
      }
      return { ok: true, autoConfirm: autoConfirm_(), bookingTimes: bookingTimes_() };
    }
    if (d.action === 'admin.decide') {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        const r = findRecord_(d.id);
        if (!r) return { ok: false, error: 'missing', message: 'Cette demande n’existe plus.' };
        return { ok: true, message: decide_(r, d) };
      } finally {
        lock.releaseLock();
      }
    }
    return { ok: false, error: 'action' };
  } catch (err) {
    return { ok: false, error: 'refused', message: String(err && err.message ? err.message : err) };
  }
}

// Connexion à « Mes rendez-vous ». Toutes les 5 erreurs, la connexion est bloquée de plus en plus
// longtemps (15 min, 30 min, 1 h, 2 h, 4 h, puis 6 h à chaque fois) et Isabelle reçoit un e-mail.
// Le compteur ne repart à zéro qu'après une connexion réussie. Les téléphones déjà connectés
// continuent de fonctionner pendant un blocage.
const ADMIN_TRIES = 5;

// Le code peut contenir des lettres (majuscules et minuscules comptent), des chiffres et des signes.
// Au moins 6 caractères s'il n'y a que des chiffres, au moins 8 s'il y a autre chose.
function codeStrong_(code) {
  return /^\d{6,}$/.test(code) || (code.length >= 8 && !/^\d+$/.test(code));
}

function adminLogin_(code) {
  const props = PropertiesService.getScriptProperties();
  const expected = String(props.getProperty('CODE_GESTION') || '').trim();
  if (!expected) return { ok: false, error: 'nocode' };
  if (!codeStrong_(expected)) return { ok: false, error: 'weak' };
  const cache = CacheService.getScriptCache();
  const until = Number(cache.get('adminLockUntil') || 0);
  if (until > Date.now()) return { ok: false, error: 'locked', minutes: Math.ceil((until - Date.now()) / 60000) };
  if (String(code || '').trim() !== expected) {
    const fails = Number(props.getProperty('ADMIN_FAILS') || 0) + 1;
    props.setProperty('ADMIN_FAILS', String(fails));
    if (fails % ADMIN_TRIES) return { ok: false, error: 'code', left: ADMIN_TRIES - (fails % ADMIN_TRIES) };
    const minutes = Math.min(15 * Math.pow(2, fails / ADMIN_TRIES - 1), 360);
    cache.put('adminLockUntil', String(Date.now() + minutes * 60000), minutes * 60);
    alertNurse_(fails, minutes);
    return { ok: false, error: 'locked', minutes: minutes };
  }
  props.deleteProperty('ADMIN_FAILS');
  cache.remove('adminLockUntil');
  return { ok: true, token: adminToken_() };
}

function alertNurse_(fails, minutes) {
  try {
    mail_(
      CONFIG.notifyEmail || Session.getEffectiveUser().getEmail(),
      'Mes rendez-vous : codes incorrects',
      fails + ' codes incorrects ont été tapés sur la page « Mes rendez-vous ». La connexion est bloquée pendant ' +
        (minutes >= 60 ? minutes / 60 + ' h' : minutes + ' minutes') + '.\n\n' +
        'Si ce n’est pas vous, changez le code (propriété CODE_GESTION du script) : tous les téléphones seront déconnectés. ' +
        'Votre téléphone déjà connecté continue de fonctionner.',
    );
  } catch (err) {
    // l'alerte ne doit jamais empêcher la réponse
  }
}

function adminToken_() {
  const code = PropertiesService.getScriptProperties().getProperty('CODE_GESTION') || '';
  return sig_('admin', 'session:' + code);
}

function adminTokenOk_(token) {
  return !!token && !!PropertiesService.getScriptProperties().getProperty('CODE_GESTION') && token === adminToken_();
}

// Heures réservables en ligne : celles qu'Isabelle a choisies dans « Mes rendez-vous » (Réglages),
// sinon celles de CONFIG.bookingTimes.
function bookingTimes_() {
  const saved = PropertiesService.getScriptProperties().getProperty('BOOKING_TIMES');
  if (saved) {
    try {
      const list = JSON.parse(saved);
      if (Array.isArray(list)) return gridTimes_().filter((t) => list.indexOf(t) >= 0);
    } catch (err) {
      // réglage illisible : on revient aux heures par défaut
    }
  }
  return CONFIG.bookingTimes.slice();
}

function autoConfirm_() {
  return PropertiesService.getScriptProperties().getProperty('AUTO_CONFIRM') === 'oui';
}

// Créneaux libres un jour donné (pour proposer un autre horaire), sans compter le rendez-vous lui-même.
function freeTimesOn_(date, commune, ignoreId, minutes) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return [];
  const day = parseYmd_(date);
  const blocks = blocks_(day, addDays_(day, 1));
  const known = CONFIG.communes.indexOf(commune) >= 0 ? commune : null;
  const now = new Date();
  return gridTimes_().filter((t) => at_(day, t) > now && fits_(blocks, at_(day, t), minutes, known, ignoreId || null));
}

function publicRecord_(r) {
  const iso = (v) => (v instanceof Date && !isNaN(v) ? v.toISOString() : null);
  return {
    id: r.id, received: iso(r.received), status: r.status, care: r.care, commune: r.commune, name: r.name,
    phone: r.phone, email: r.email, address: r.address, access: r.access, wishDate: r.wishDate, moment: r.moment,
    message: r.message, appointment: iso(r.appointment), minutes: Number(r.minutes) || null, eventId: r.eventId || null,
  };
}

// ------------------------------------------------------------------ messages

function notifyNurse_(r, subject) {
  const link = webUrl_() + '?action=gerer&id=' + encodeURIComponent(r.id) + '&sig=' + sig_(r.id, 'nurse');
  notify_(subject, [
    'Soin : ' + r.care,
    r.appointment ? 'Horaire demandé : ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) + ' (' + r.minutes + ' min)' : 'Souhait : ' + (r.wishDate ? longDate_(parseYmd_(r.wishDate)) : 'pas de date') + ', ' + (r.moment || 'peu importe').toLowerCase(),
    '',
    'Nom : ' + r.name,
    'Téléphone : ' + r.phone,
    'E-mail : ' + (r.email || 'non donné'),
    'Adresse : ' + r.address + ', ' + r.commune,
    r.access ? 'Pour trouver : ' + r.access : null,
    r.message ? 'Message : ' + r.message : null,
    '',
    r.status === STATUS.confirmed ? 'Rendez-vous confirmé automatiquement. Pour le voir, le déplacer ou l’annuler :' : 'CONFIRMER, REFUSER OU PROPOSER UN AUTRE HORAIRE :',
    CONFIG.adminUrl + '#' + r.id,
    '',
    '(Lien de secours : ' + link + ')',
    '',
    r.appointment && r.status !== STATUS.confirmed ? 'L’horaire est bloqué dans votre agenda (en gris) en attendant votre réponse.' : null,
  ].filter((line) => line !== null).join('\n'));
}

function ackPatient_(r) {
  if (!r.email) return;
  mail_(r.email, 'Demande de rendez-vous bien reçue',
    'Bonjour,\n\nJ’ai bien reçu votre demande (' + r.care.toLowerCase() +
      (r.appointment ? ', le ' + longDate_(r.appointment) + ' à ' + time_(r.appointment) : '') +
      '). Je vous confirme le rendez-vous par e-mail dès que possible.\n\nPour toute question : ' + PHONE_DISPLAY + '.' + signature_());
}

// Prévient le patient par e-mail, et par SMS si un service SMS est configuré. Renvoie true si au moins un message est parti.
function tellPatient_(r, subject, body, sms) {
  let sent = false;
  if (r.email) {
    mail_(r.email, subject, 'Bonjour,\n\n' + body + signature_());
    sent = true;
  }
  if (smsEnabled_() && isMobile_(r.phone)) sent = sendSms_(r.phone, sms) || sent;
  return sent;
}

function signature_() {
  return '\n\nIsabelle Buisson\nInfirmière libérale diplômée d’État\n' + PHONE_DISPLAY + '\nhttps://cabinet-infirmier-rouffiac.fr';
}

function notify_(subject, body) {
  mail_(CONFIG.notifyEmail || Session.getEffectiveUser().getEmail(), subject, body);
}

function mail_(to, subject, body) {
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: 'Isabelle Buisson, infirmière' });
}

// SMS via Brevo (payant, quelques centimes par SMS). Activé seulement si la clé
// BREVO_API_KEY est enregistrée dans les propriétés du script (voir LISEZMOI.md).
function smsEnabled_() {
  return !!PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY');
}

function isMobile_(phone) {
  const digits = String(phone).replace(/\D/g, '').replace(/^0033/, '0').replace(/^33/, '0');
  return /^0[67]\d{8}$/.test(digits);
}

function sendSms_(phone, content) {
  const digits = String(phone).replace(/\D/g, '').replace(/^0033/, '0').replace(/^33/, '0');
  const res = UrlFetchApp.fetch('https://api.brevo.com/v3/transactionalSMS/sms', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'api-key': PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY') },
    payload: JSON.stringify({ type: 'transactional', sender: CONFIG.smsSender, recipient: '33' + digits.slice(1), content: content }),
    muteHttpExceptions: true,
  });
  const ok = res.getResponseCode() < 300;
  if (!ok) console.error('SMS non envoyé : ' + res.getContentText());
  return ok;
}

// ------------------------------------------------------------------ tableau des demandes

function sheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id).getSheets()[0];
  const ss = SpreadsheetApp.create('Rendez-vous du site');
  const sh = ss.getSheets()[0];
  sh.setName('Demandes');
  sh.appendRow(COLUMNS);
  sh.setFrozenRows(1);
  props.setProperty('SHEET_ID', ss.getId());
  return sh;
}

function toRecord_(v) {
  return {
    id: String(v[0]), received: v[1] || null, status: v[2], care: v[3], commune: v[4], name: v[5], phone: String(v[6]),
    email: v[7], address: v[8], access: v[9], people: Number(v[10]) || 1, wishDate: v[11] ? String(v[11]) : '',
    moment: v[12], message: v[13], appointment: v[14] instanceof Date ? v[14] : (v[14] ? new Date(v[14]) : null),
    minutes: v[15], eventId: v[16], reminded: v[17],
  };
}

function toRow_(r) {
  return [r.id, r.received, r.status, r.care, r.commune, r.name, "'" + r.phone, r.email, r.address, r.access, r.people,
    r.wishDate ? "'" + r.wishDate : '', r.moment, r.message, r.appointment || '', r.minutes, r.eventId, r.reminded || ''];
}

function allRecords_() {
  return sheet_().getDataRange().getValues().slice(1).map(toRecord_);
}

function findRecord_(id) {
  return allRecords_().filter((r) => r.id === id)[0] || null;
}

function saveRecord_(r) {
  const sh = sheet_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map((x) => String(x[0]));
  const i = ids.indexOf(r.id);
  if (i < 1) sh.appendRow(toRow_(r));
  else sh.getRange(i + 1, 1, 1, COLUMNS.length).setValues([toRow_(r)]);
}

// ------------------------------------------------------------------ agenda

function calendar_() {
  const cal = CONFIG.calendarId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.calendarId);
  if (!cal) throw new Error('Agenda introuvable : vérifiez calendarId dans CONFIG (ID de l’agenda boulot).');
  return cal;
}

// Cherche dans l'agenda boulot, puis dans l'agenda principal (rendez-vous créés avant le changement d'agenda).
function eventById_(id) {
  if (!id) return null;
  const tries = [calendar_, () => CalendarApp.getDefaultCalendar()];
  for (let i = 0; i < tries.length; i++) {
    try {
      const ev = tries[i]().getEventById(id);
      if (ev) return ev;
    } catch (err) {
      // on essaie l'agenda suivant
    }
  }
  return null;
}

function deleteEvent_(r) {
  const ev = eventById_(r.eventId);
  if (ev) ev.deleteEvent();
  r.eventId = '';
}

function eventTitle_(r, status) {
  const prefix = status === STATUS.confirmed ? '' : status === STATUS.proposed ? '⏳ Proposé · ' : '⏳ À confirmer · ';
  return prefix + r.care + ' · ' + r.name;
}

function eventDescription_(r) {
  return [
    'Téléphone : ' + r.phone,
    r.email ? 'E-mail : ' + r.email : null,
    'Adresse : ' + r.address + ', ' + r.commune,
    r.access ? 'Pour trouver : ' + r.access : null,
    '',
    'Demande faite sur le site. Gérer : ' + CONFIG.adminUrl + '#' + r.id,
    'Lien de secours : ' + webUrl_() + '?action=gerer&id=' + encodeURIComponent(r.id) + '&sig=' + sig_(r.id, 'nurse'),
  ].filter((line) => line !== null).join('\n');
}

// ------------------------------------------------------------------ sécurité des liens

function sig_(id, role) {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret) throw new Error('Lancez d’abord la fonction installer().');
  const bytes = Utilities.computeHmacSha256Signature(id + ':' + role, secret);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function checkSig_(id, role, sig) {
  return !!id && !!sig && sig_(id, role) === sig;
}

function webUrl_() {
  return ScriptApp.getService().getUrl();
}

// ------------------------------------------------------------------ outils

function page_(body, title) {
  const html =
    '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc_(title) + '</title>' +
    '<style>body{font:18px/1.5 Lato,"Segoe UI",Arial,sans-serif;color:#1f2328;max-width:640px;margin:0 auto;padding:24px}' +
    'h1{font-size:28px;margin:0 0 8px}h2{font-size:20px;margin:0 0 12px}section{margin:24px 0;padding:20px;border-radius:14px;background:#f5f5f4}' +
    'dl{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:16px 0}dt{font-weight:700}dd{margin:0}' +
    'label{display:block;margin:0 0 12px;font-weight:700}input,select,textarea{display:block;width:100%;margin-top:4px;padding:10px;font:inherit;border:1.5px solid #c9cdd2;border-radius:10px;box-sizing:border-box}' +
    '.check{font-weight:400}.check input{display:inline;width:auto;margin-right:8px}' +
    'button{min-height:50px;padding:0 24px;border:0;border-radius:999px;background:#d8312e;color:#fff;font:700 18px Lato,Arial,sans-serif;cursor:pointer}' +
    'button.secondary{background:#fff;color:#1f2328;border:2px solid #c9cdd2}button:disabled{opacity:.5}' +
    '.note,.status{color:#5b6168}#result{font-weight:700;margin-top:16px}a{color:#1f2328}</style>' +
    body;
  return HtmlService.createHtmlOutput(html).setTitle(title).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function row_(label, value, raw) {
  return '<dt>' + esc_(label) + '</dt><dd>' + (raw ? value : esc_(value)) + '</dd>';
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function tz_() {
  return Session.getScriptTimeZone();
}

function gridTimes_() {
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const out = [];
  for (let m = toMin(CONFIG.firstStart); m <= toMin(CONFIG.lastStart); m += CONFIG.step) {
    out.push(('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2));
  }
  return out;
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
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function ymd_(d) {
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function hhmm_(d) {
  return Utilities.formatDate(d, tz_(), 'HH:mm');
}

function time_(d) {
  const [h, m] = hhmm_(d).split(':');
  return Number(h) + ' h ' + m;
}

function longDate_(d) {
  return DAYS_FR[d.getDay()] + ' ' + (d.getDate() === 1 ? '1er' : d.getDate()) + ' ' + MONTHS_FR[d.getMonth()];
}

function shortDate_(d) {
  return DAYS_FR[d.getDay()].slice(0, 3) + '. ' + d.getDate() + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
}

function isWorkday_(d) {
  const iso = d.getDay() === 0 ? 7 : d.getDay();
  return CONFIG.weekdays.indexOf(iso) >= 0;
}

// Jours où l'on peut faire une réservation en ligne (CONFIG.bookingDays : aujourd'hui, tous les jours).
function canBookNow_(now) {
  const iso = now.getDay() === 0 ? 7 : now.getDay();
  return CONFIG.bookingDays.indexOf(iso) >= 0;
}

// Pour le jour J, les demandes en ligne ferment la veille à CONFIG.cutoffHour heures.
function isOpen_(day, now) {
  const cutoff = new Date(day.getFullYear(), day.getMonth(), day.getDate() - 1, CONFIG.cutoffHour, 0);
  return now < cutoff;
}

// Test depuis l'éditeur : affiche les créneaux libres pour Brenoux.
function tester() {
  console.log(JSON.stringify(listDays_('Brenoux'), null, 2));
}

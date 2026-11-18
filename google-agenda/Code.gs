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
  calendarId: 'primary', // 'primary' = l'agenda principal du compte
  notifyEmail: '', // vide = l'adresse du compte Google qui déploie le script
  communes: ['Saint-Bauzile', 'Balsièges', 'Brenoux', 'Lanuéjols'],

  // Créneaux proposés en ligne (heure de Paris) : toutes les 30 min de 7 h à 18 h 30 (fin à 19 h).
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

  weekdays: [1, 2, 3, 4, 5, 6, 7], // jours où un rendez-vous peut avoir lieu (1 = lundi … 7 = dimanche)
  bookingDays: [1, 2, 3, 4, 5], // jours où l'on peut réserver en ligne : pas le samedi ni le dimanche
  cutoffHour: 18, // demande possible jusqu'à la veille à cette heure
  daysAhead: 21,
  reminderHour: 17, // heure d'envoi des rappels, la veille du rendez-vous
  keepDays: 90, // les demandes sont effacées après ce délai (fonction nettoyer)
  smsSender: 'IBuisson', // nom d'expéditeur des SMS (11 caractères max, sans espace)
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
};
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
  try {
    if (data.action === 'book') return json_(book_(data));
    if (data.action === 'callback') return json_(request_(data));
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
  return json_({ ok: false, error: 'action' });
}

// ------------------------------------------------------------------ horaires libres (trajets compris)

function listDays_(commune) {
  const now = new Date();
  if (!canBookNow_(now)) return { ok: true, days: [], closed: 'weekend' };
  const first = addDays_(startOfDay_(now), 1);
  const last = addDays_(startOfDay_(now), CONFIG.daysAhead);
  const blocks = blocks_(first, addDays_(last, 1));
  const knownCommune = CONFIG.communes.indexOf(commune) >= 0 ? commune : null;
  const days = [];
  for (let d = first; d <= last; d = addDays_(d, 1)) {
    if (!isWorkday_(d)) continue;
    const open = isOpen_(d, now) && !!knownCommune;
    const times = open
      ? gridTimes_().filter((t) => fits_(blocks, at_(d, t), CONFIG.duration, knownCommune, null))
      : [];
    days.push({ date: ymd_(d), open: open, times: times });
  }
  return { ok: true, days: days };
}

// Événements de l'agenda sur une période, avec leur commune si on la connaît.
function blocks_(from, to) {
  return calendar_()
    .getEvents(from, to)
    .map((ev) => ({
      id: ev.getId(),
      start: ev.getStartTime(),
      end: ev.getEndTime(),
      allDay: ev.isAllDayEvent(),
      commune: communeOf_(ev),
    }));
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
    notifyNurse_(r, 'Nouvelle demande : ' + r.care.toLowerCase() + ' le ' + longDate_(start) + ' à ' + time_(start));
    ackPatient_(r);
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
  if (gridTimes_().indexOf(d.time) < 0) return 'time';
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
    (when && r.status !== STATUS.confirmed
      ? '<section><h2>Valider</h2><button onclick="send(\'valider\')">Valider ce rendez-vous</button></section>'
      : '') +
    '<section><h2>' + (when ? 'Proposer un autre horaire' : 'Proposer un horaire') + '</h2>' +
    '<label>Jour <input type="date" id="date" value="' + defaultDate + '"></label>' +
    '<label>Heure <input type="time" id="time" step="300" value="' + defaultTime + '"></label>' +
    '<label>Durée (min) <select id="minutes">' + durationOptions + '</select></label>' +
    '<label class="check"><input type="checkbox" id="agreed"> Déjà convenu avec le patient (confirmer directement)</label>' +
    '<label>Message pour le patient (facultatif) <textarea id="propose-msg" rows="2"></textarea></label>' +
    '<button onclick="send(\'proposer\')">Proposer cet horaire</button></section>' +
    '<section><h2>Refuser</h2>' +
    '<label>Message pour le patient (facultatif) <textarea id="refuse-msg" rows="2"></textarea></label>' +
    '<button class="secondary" onclick="send(\'refuser\')">Refuser la demande</button></section>' +
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
    const message = clean_(p.message, 500);

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
  } finally {
    lock.releaseLock();
  }
}

function confirm_(r, message) {
  const ev = eventById_(r.eventId);
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
    'VALIDER, REFUSER OU PROPOSER UN AUTRE HORAIRE :',
    link,
    '',
    r.appointment ? 'L’horaire est bloqué dans votre agenda (en gris) en attendant votre réponse.' : null,
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
  return CONFIG.calendarId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CONFIG.calendarId);
}

function eventById_(id) {
  if (!id) return null;
  try {
    return calendar_().getEventById(id);
  } catch (err) {
    return null;
  }
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
    'Demande faite sur le site. Gérer : ' + webUrl_() + '?action=gerer&id=' + encodeURIComponent(r.id) + '&sig=' + sig_(r.id, 'nurse'),
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

// La réservation en ligne elle-même est fermée le samedi et le dimanche.
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

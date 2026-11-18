// « Mes rendez-vous » : la page d'Isabelle pour gérer les demandes du site depuis son téléphone.
// Elle parle au script Google (agenda, e-mails, tableau) ; rien n'est stocké sur le site.
// Les e-mails gardent aussi le lien de secours vers l'ancienne page Google.
import { CONFIG } from './config.js';
import { gridTimes } from './slots.js';
import { callScript } from './gas.js';

const TZ = 'Europe/Paris';
const TOKEN_KEY = 'rdv.token';
const params = new URLSearchParams(location.search);
const DEMO = !CONFIG.endpoint || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !params.has('live'));
// Les fausses données ne sont chargées qu'en démonstration (jamais sur le vrai site).
const demo = DEMO ? await import('./admin-demo.js') : null;
const demoApi = demo ? demo.createDemoApi(CONFIG) : null;
const DEMO_CODE = demo ? demo.DEMO_CODE : '';
const GRID = gridTimes(CONFIG); // 07:00 … 18:30
const DAYS_SHOWN = 14;
const WIDE = matchMedia('(min-width: 900px)');
// Réglages du projet « Rendez-vous site » dans Google Apps Script (accessible seulement avec le compte d'Isabelle).
const SCRIPT_SETTINGS = 'https://script.google.com/home/projects/1qEcGYbnnE8en4CDx1dtDnOnCQFtRSflIw9bqGJ1VLoIBwltZ68pduh6T/settings';

const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const state = {
  // En démonstration, « ?entrer » ouvre directement la page (pour les captures d'écran).
  token: DEMO && params.has('entrer') ? 'demo-token' : read(TOKEN_KEY),
  items: [],
  autoConfirm: false,
  bookingTimes: CONFIG.bookingTimes.slice(), // heures réservables en ligne (réglables dans Réglages)
  hoursDraft: null, // heures en cours de modification, pas encore enregistrées
  tab: 'todo', // todo | plan | history | settings
  open: null, // id de la fiche ouverte
  sub: null, // null | 'propose' | 'refuse' | 'cancel'
  planDay: '', // réglé plus bas, une fois les formats de date prêts
  days: {}, // horaires libres par jour : { '2026-11-19': { free: [...], at } }
  form: null, // formulaire « autre horaire » ou « refus » en cours
  loaded: false,
  busy: false,
  error: '',
  updatedAt: null,
  pushed: 0, // pages ajoutées à l'historique du navigateur (bouton retour du téléphone)
  listScroll: 0,
};

// ------------------------------------------------------------------ outils

function read(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function write(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* navigation privée : on garde en mémoire seulement */
  }
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (id) => `<svg class="ic" aria-hidden="true"><use href="#${id}"/></svg>`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const fmtDay = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short', day: 'numeric' });
const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, weekday: 'short' });
const fmtDayNum = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, day: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtYmd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function ymdOf(date) {
  return fmtYmd.format(date);
}
state.planDay = ymdOf(new Date());
const dateOfYmd = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
};
const addDays = (ymd, n) => ymdOf(new Date(dateOfYmd(ymd).getTime() + n * 86400000));
const hhmmOf = (date) => fmtTime.format(date);
const timeLabel = (hhmm) => {
  const [h, m] = hhmm.split(':');
  return `${Number(h)} h ${m}`;
};
const timeOf = (date) => timeLabel(hhmmOf(date));
const plusMinutes = (hhmm, minutes) => {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m + minutes;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

// « Aujourd'hui », « Demain », sinon « Jeudi 21 novembre ».
function dayName(ymd, long = true) {
  const today = ymdOf(new Date());
  if (ymd === today) return 'Aujourd’hui';
  if (ymd === addDays(today, 1)) return 'Demain';
  if (ymd === addDays(today, -1)) return 'Hier';
  return cap((long ? fmtDay : fmtShort).format(dateOfYmd(ymd)));
}
const fullDay = (ymd) => cap(fmtDay.format(dateOfYmd(ymd)));

const mapsUrl = (r) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([r.address, r.commune === 'Autre commune' ? '' : r.commune, 'Lozère'].filter(Boolean).join(', '))}`;
const telUrl = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
const place = (r) => (r.commune && r.commune !== 'Autre commune' ? r.commune : 'Autre commune');

function toast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('toast--error', isError);
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toastEl.hidden = true), isError ? 7000 : 5000);
}

// ------------------------------------------------------------------ échanges avec le script Google

async function api(action, payload = {}) {
  const body = { action, token: state.token, ...payload };
  if (DEMO) return demoApi(action, body);
  // Relancée automatiquement si Google tarde (voir gas.js) ; les actions ne sont jamais faites deux fois.
  // Lectures : doublées dès 3 s. Actions (e-mails, agenda) : le script met plus longtemps, 5 s.
  const read = action === 'admin.list' || action === 'admin.slots';
  return callScript(CONFIG.endpoint, { body, hedge: read ? 3000 : 5000 });
}

// ------------------------------------------------------------------ classement

const LIVE = ['En attente', 'Horaire proposé', 'Confirmé'];
const ymdOfItem = (r) => (r.appointment ? ymdOf(new Date(r.appointment)) : null);
const isFuture = (r) => r.appointment && new Date(r.appointment).getTime() + (r.minutes || 30) * 60000 > Date.now();

function groups() {
  const byDate = (a, b) => new Date(a.appointment) - new Date(b.appointment);
  const wish = (r) => new Date(r.appointment || (r.wishDate ? `${r.wishDate}T12:00:00` : r.received));
  // Une demande jamais traitée dont l'heure est passée part dans l'historique (« Sans réponse »).
  const toConfirm = state.items.filter((r) => r.status === 'En attente' && r.appointment && isFuture(r)).sort(byDate);
  const toCall = state.items.filter((r) => r.status === 'En attente' && !r.appointment).sort((a, b) => wish(a) - wish(b));
  const waiting = state.items.filter((r) => r.status === 'Horaire proposé' && isFuture(r)).sort(byDate);
  const upcoming = state.items.filter((r) => LIVE.includes(r.status) && r.appointment && isFuture(r));
  const history = state.items
    .filter((r) => !toConfirm.includes(r) && !toCall.includes(r) && !(LIVE.includes(r.status) && isFuture(r)))
    .sort((a, b) => wish(b) - wish(a));
  return { toConfirm, toCall, waiting, upcoming, history, todo: toConfirm.length + toCall.length };
}

const STATUS = {
  'En attente': { label: 'À confirmer', kind: 'warn' },
  'Horaire proposé': { label: 'Attend le patient', kind: 'info' },
  Confirmé: { label: 'Confirmé', kind: 'ok' },
  Refusé: { label: 'Refusé', kind: 'off' },
  'Refusé par le patient': { label: 'Refusé par le patient', kind: 'off' },
  Annulé: { label: 'Annulé', kind: 'off' },
};
function statusOf(r) {
  if (r.status === 'En attente' && !r.appointment) return { label: 'À rappeler', kind: 'warn' };
  if (r.status === 'En attente' && !isFuture(r)) return { label: 'Sans réponse', kind: 'off' };
  if (r.status === 'Confirmé' && !isFuture(r)) return { label: 'Passé', kind: 'off' };
  return STATUS[r.status] || { label: r.status, kind: 'off' };
}
const pill = (s) => `<span class="pill pill--${s.kind}">${esc(s.label)}</span>`;

// ------------------------------------------------------------------ squelette

const TABS = [
  { id: 'todo', label: 'Demandes', title: 'Demandes', icon: 'i-inbox' },
  { id: 'plan', label: 'Planning', title: 'Planning', icon: 'i-cal' },
  { id: 'history', label: 'Historique', title: 'Historique', icon: 'i-history' },
  { id: 'settings', label: 'Réglages', title: 'Réglages', icon: 'i-sliders' },
];

function render() {
  if (!state.token) return renderLogin();
  const g = groups();
  const tab = TABS.find((t) => t.id === state.tab);
  if (state.open && state.loaded && !state.items.some((i) => i.id === state.open)) state.open = null;
  // Sur un grand écran, la liste et la fiche sont côte à côte : on ouvre la première d'office.
  if (!state.open && state.loaded && WIDE.matches) state.open = firstOf(g);
  const r = state.open && state.items.find((i) => i.id === state.open);
  const solo = state.tab === 'settings';
  const anim = state.anim;
  state.anim = null;
  document.body.classList.toggle('is-open', !!state.open);
  app.innerHTML = `
    <div class="shell${state.open ? ' is-open' : ''}${state.sub ? ' has-sub' : ''}${solo ? ' is-solo' : ''}">
      <header class="bar">
        <div class="bar__in">
          <svg class="bar__logo" aria-hidden="true"><use href="#logo"/></svg>
          <div class="bar__title">
            <p class="bar__app">Mes rendez-vous</p>
            <h1>${tab.title}</h1>
          </div>
          <nav class="tabbar" aria-label="Sections">
            ${TABS.map((t) => `<button type="button" class="tabbar__btn" data-tab="${t.id}"${t.id === state.tab ? ' aria-current="page"' : ''}>${icon(t.icon)}<span>${t.label}</span>${t.id === 'todo' && g.todo ? `<b class="tabbar__count" aria-label="${plural(g.todo, 'demande', 'demandes')}">${g.todo}</b>` : ''}</button>`).join('')}
          </nav>
          <button type="button" class="iconbtn" data-action="refresh" aria-label="Actualiser"${state.busy ? ' disabled' : ''}>${icon('i-refresh')}</button>
        </div>
      </header>
      <div class="panes">
        <section class="pane pane--list${anim === 'list' ? ' is-entering' : ''}" aria-label="${tab.title}">
          ${DEMO ? `<p class="demo">Démonstration avec de fausses données. Rien n’est envoyé aux patients.</p>` : ''}
          ${listPane(g)}
        </section>
        ${solo ? '' : `<section class="pane pane--detail${anim === 'detail' ? ' is-entering' : ''}" aria-label="Fiche">${r ? detailPane(r) : emptyDetail()}</section>`}
      </div>
    </div>`;
  if (state.tab === 'plan') ensureDay(state.planDay);
  if (state.sub === 'propose' && state.form) ensureDay(state.form.date, true);
}

function firstOf(g) {
  if (state.tab === 'todo') return (g.toConfirm[0] || g.toCall[0] || g.waiting[0] || {}).id || null;
  if (state.tab === 'history') return (g.history[0] || {}).id || null;
  if (state.tab === 'plan') {
    const v = state.items
      .filter((i) => i.appointment && ymdOfItem(i) === state.planDay && LIVE.includes(i.status))
      .sort((a, b) => new Date(a.appointment) - new Date(b.appointment));
    return (v[0] || {}).id || null;
  }
  return null;
}

function stamp() {
  if (state.busy) return '<p class="stamp">Mise à jour…</p>';
  if (!state.updatedAt) return '';
  const today = ymdOf(state.updatedAt) === ymdOf(new Date());
  return `<p class="stamp">À jour ${today ? '' : `le ${esc(dayName(ymdOf(state.updatedAt), false).toLowerCase())} `}à ${timeOf(state.updatedAt)}</p>`;
}

function listPane(g) {
  if (!state.loaded) return skeleton();
  if (state.error && !state.items.length) return errorBlock();
  if (state.tab === 'todo') return todoPane(g);
  if (state.tab === 'plan') return planPane(g);
  if (state.tab === 'history') return historyPane(g);
  return settingsPane();
}

function skeleton() {
  const row = '<div class="row row--skel"><span class="skel skel--name"></span><span class="skel skel--line"></span></div>';
  return `<p class="lead"><span class="skel skel--lead"></span></p><div class="list">${row.repeat(3)}</div>`;
}

function errorBlock() {
  return `<div class="notice notice--error"><p>${esc(state.error)}</p><button type="button" class="textbtn" data-action="refresh">Réessayer</button></div>`;
}

// ------------------------------------------------------------------ Demandes

function todoPane(g) {
  const lead = g.todo
    ? `${plural(g.todo, 'demande attend', 'demandes attendent')} votre réponse.${g.toConfirm[0] ? ` La plus proche : ${dayName(ymdOfItem(g.toConfirm[0])).toLowerCase()} à ${timeOf(new Date(g.toConfirm[0].appointment))}.` : ''}`
    : 'Aucune demande à traiter. Les nouvelles demandes du site arrivent ici.';
  return `
    <p class="lead">${lead}</p>
    ${state.autoConfirm ? '<p class="note">Confirmation automatique activée : les créneaux réservés en ligne sont confirmés tout seuls.</p>' : ''}
    ${state.error ? errorBlock() : ''}
    ${section('Créneaux à confirmer', g.toConfirm, 'Aucun créneau à confirmer.')}
    ${section('Patients à rappeler', g.toCall, 'Aucune demande de rappel.')}
    ${g.waiting.length ? section('En attente de la réponse du patient', g.waiting) : ''}
    ${stamp()}`;
}

function section(title, list, empty = '') {
  return `<div class="group">
    <h2 class="group__title">${title}<span class="num">${list.length}</span></h2>
    ${list.length ? `<div class="list">${list.map(row).join('')}</div>` : `<p class="empty">${empty}</p>`}
  </div>`;
}

function row(r) {
  const s = statusOf(r);
  const urgent = r.status === 'En attente';
  let when;
  if (r.appointment) {
    const d = new Date(r.appointment);
    when = `${dayName(ymdOf(d), false)} · ${timeOf(d)}`;
  } else {
    when = r.wishDate ? `Souhait : ${dayName(r.wishDate, false).toLowerCase()}${r.moment && r.moment !== 'Peu importe' ? `, ${esc(r.moment.toLowerCase())}` : ''}` : 'Sans date';
  }
  return `<button type="button" class="row${state.open === r.id ? ' is-selected' : ''}" data-open="${esc(r.id)}">
    <span class="row__dot${urgent ? ' row__dot--on' : ''}" aria-hidden="true"></span>
    <span class="row__main">
      <span class="row__l1"><span class="row__name">${esc(r.name)}</span><span class="row__when num">${when}</span></span>
      <span class="row__l2"><span class="row__what">${esc(r.care)} · ${esc(place(r))}</span>${state.tab === 'history' ? pill(s) : ''}</span>
    </span>
    ${icon('i-next')}
  </button>`;
}

// ------------------------------------------------------------------ Planning

function dayStrip(selected, action, counts = {}) {
  const today = ymdOf(new Date());
  let html = '';
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const ymd = addDays(today, i);
    const d = dateOfYmd(ymd);
    const label = i === 0 ? 'auj.' : i === 1 ? 'dem.' : fmtWeekday.format(d).replace('.', '');
    const n = counts[ymd] || 0;
    html += `<button type="button" class="day${ymd === selected ? ' is-on' : ''}" data-${action}="${ymd}" aria-pressed="${ymd === selected}" aria-label="${esc(fullDay(ymd))}${n ? `, ${plural(n, 'rendez-vous', 'rendez-vous')}` : ''}">
      <span class="day__wd">${label}</span><span class="day__n num">${fmtDayNum.format(d)}</span><span class="day__c">${n ? `<i style="--n:${Math.min(n, 4)}"></i>` : ''}</span>
    </button>`;
  }
  return `<div class="days" role="group" aria-label="Jour">${html}</div>`;
}

function planPane(g) {
  const day = state.planDay;
  const counts = {};
  for (const r of g.upcoming) counts[ymdOfItem(r)] = (counts[ymdOfItem(r)] || 0) + 1;
  const visits = state.items
    .filter((r) => r.appointment && ymdOfItem(r) === day && LIVE.includes(r.status))
    .sort((a, b) => new Date(a.appointment) - new Date(b.appointment));
  const info = state.days[day];
  const free = info ? info.free.length : null;
  return `
    ${dayStrip(day, 'plan-day', counts)}
    <div class="daycard">
      <div class="daycard__head">
        <h2>${esc(dayName(day))}</h2>
        <p class="daycard__fig"><span class="num">${free === null ? '–' : free}</span> ${free === 1 ? 'créneau libre' : 'créneaux libres'}</p>
      </div>
      ${timeline(day, visits, info)}
    </div>
    <div class="group">
      <h2 class="group__title">Rendez-vous du site<span class="num">${visits.length}</span></h2>
      ${visits.length ? `<div class="list">${visits.map(visitRow).join('')}</div>` : '<p class="empty">Aucun rendez-vous pris sur le site ce jour-là.</p>'}
    </div>
    <p class="note">Le planning montre les rendez-vous du site. Vos autres rendez-vous de l’agenda apparaissent en gris dans la journée.</p>`;
}

// La journée de 7 h à 19 h, case par case de 30 minutes.
function timeline(day, visits, info) {
  const now = new Date();
  const free = info ? new Set(info.free) : null;
  const taken = {};
  for (const r of visits) {
    const start = hhmmOf(new Date(r.appointment));
    const slots = Math.max(1, Math.ceil((r.minutes || 30) / CONFIG.step));
    for (let i = 0; i < slots; i++) taken[plusMinutes(start, i * CONFIG.step)] = r.status === 'Confirmé' ? 'site' : 'wait';
  }
  const cells = GRID.map((t) => {
    const at = new Date(`${day}T${t}:00`);
    let kind = 'free';
    if (taken[t]) kind = taken[t];
    else if (at < now) kind = 'past';
    else if (!free) kind = 'unknown';
    else if (!free.has(t)) kind = 'busy';
    return `<span class="cell cell--${kind}" title="${timeLabel(t)}"></span>`;
  }).join('');
  const ticks = [7, 10, 13, 16, 19].map((h) => `<span style="left:${((h - 7) / 12) * 100}%">${h} h</span>`).join('');
  return `<div class="tl" role="img" aria-label="Journée de 7 h à 19 h">
      <div class="tl__cells">${cells}</div>
      <div class="tl__ticks">${ticks}</div>
    </div>
    <ul class="legend">
      <li><span class="cell cell--site"></span>Confirmé</li>
      <li><span class="cell cell--wait"></span>À confirmer</li>
      <li><span class="cell cell--busy"></span>Agenda</li>
      <li><span class="cell cell--free"></span>Libre</li>
    </ul>`;
}

function visitRow(r) {
  const d = new Date(r.appointment);
  const s = statusOf(r);
  return `<button type="button" class="row row--visit${state.open === r.id ? ' is-selected' : ''}" data-open="${esc(r.id)}">
    <span class="row__time num">${timeOf(d)}</span>
    <span class="row__main">
      <span class="row__l1"><span class="row__name">${esc(r.name)}</span>${r.status === 'Confirmé' ? '' : pill(s)}</span>
      <span class="row__l2"><span class="row__what">${esc(r.care)} · ${esc(place(r))}</span></span>
    </span>
    ${icon('i-next')}
  </button>`;
}

// ------------------------------------------------------------------ Historique

function historyPane(g) {
  return `
    <p class="lead">Les demandes passées, refusées ou annulées. Elles sont effacées 3 mois après le rendez-vous.</p>
    ${g.history.length ? `<div class="list">${g.history.map(row).join('')}</div>` : '<p class="empty">Rien pour l’instant.</p>'}`;
}

// ------------------------------------------------------------------ Réglages

function settingsPane() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return `
    <div class="setgroup">
      <h2 class="group__title">Confirmation</h2>
      <div class="setrow">
        <div>
          <p class="setrow__title" id="auto-label">Confirmer automatiquement</p>
          <p class="setrow__hint">${state.autoConfirm ? 'Activé. Les créneaux choisis en ligne sont confirmés tout de suite : le patient reçoit sa confirmation, vous recevez un e-mail. Vous pouvez toujours déplacer ou annuler.' : 'Désactivé. Chaque créneau choisi en ligne attend que vous le confirmiez.'}</p>
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${state.autoConfirm}" aria-labelledby="auto-label" data-action="auto"><span></span></button>
      </div>
      <p class="setgroup__foot">Les demandes de rappel (autres soins, autres communes) restent toujours à traiter vous-même.</p>
    </div>
    ${hoursSetting()}
    ${standalone ? '' : `<div class="setgroup">
      <h2 class="group__title">Sur l’écran d’accueil</h2>
      <div class="setrow setrow--text">
        <p>${ios ? 'Dans Safari, touchez <b>Partager</b> (le carré avec une flèche), puis <b>Sur l’écran d’accueil</b>.' : 'Dans Chrome, touchez le menu <b>⋮</b>, puis <b>Ajouter à l’écran d’accueil</b>.'} L’icône ouvre ensuite cette page comme une application.</p>
      </div>
    </div>`}
    <div class="setgroup">
      <h2 class="group__title">Si cette page ne répond pas</h2>
      <div class="setrow setrow--text">
        <p>Chaque e-mail de nouvelle demande contient aussi un lien de secours, qui ouvre la page de gestion Google comme avant. Les deux marchent en même temps.</p>
      </div>
    </div>
    <div class="setgroup">
      <h2 class="group__title">Ce téléphone</h2>
      <div class="setrow setrow--text">
        <p>Ce téléphone reste connecté. En cas de perte, changez le code dans le script Google : tous les téléphones seront déconnectés.</p>
        <ol class="steps">
          <li>Ouvrez les <a href="${SCRIPT_SETTINGS}" target="_blank" rel="noopener">réglages du script Google</a>, connectée à votre compte Google.</li>
          <li>Descendez jusqu’à <b>Propriétés du script</b>, puis touchez <b>Modifier les propriétés du script</b>.</li>
          <li>Sur la ligne <b>CODE_GESTION</b>, remplacez la valeur par le nouveau code, puis <b>Enregistrer les propriétés du script</b>.</li>
        </ol>
        <p class="setrow__hint">Le code n’est pas écrit dans le programme lui-même (pas de numéro de ligne à chercher) : il est seulement dans ces propriétés. Pas besoin de redéployer.</p>
        <button type="button" class="textbtn textbtn--danger" data-action="logout">Se déconnecter de ce téléphone</button>
      </div>
    </div>`;
}

// Les heures que les patients peuvent réserver en ligne, du lundi au vendredi.
function hoursSetting() {
  const saved = state.bookingTimes;
  const sel = state.hoursDraft || saved;
  const changed = state.hoursDraft && state.hoursDraft.join() !== saved.join();
  return `
    <div class="setgroup">
      <h2 class="group__title" id="hours-label">Heures réservables en ligne</h2>
      <div class="setrow setrow--text">
        <p class="setrow__hint">Du lundi au vendredi. Touchez une heure pour l’ajouter ou la retirer, puis enregistrez. Une heure déjà prise dans votre agenda n’est jamais proposée.</p>
        <div class="slots hours" role="group" aria-labelledby="hours-label">
          ${GRID.map((t) => `<button type="button" class="slot num" data-hour="${t}" aria-pressed="${sel.includes(t)}">${timeLabel(t)}</button>`).join('')}
        </div>
        <p class="hours__sum">${sel.length ? `${plural(sel.length, 'heure proposée', 'heures proposées')} aux patients.` : 'Aucune heure : les patients ne pourront plus choisir de créneau en ligne. Les demandes de rappel restent possibles.'}</p>
        ${changed ? `<div class="actions__row hours__actions">
          <button type="button" class="btn btn--primary" data-action="save-hours">Enregistrer</button>
          <button type="button" class="btn" data-action="reset-hours">Annuler</button>
        </div>` : ''}
      </div>
    </div>`;
}

async function saveHours(button) {
  const times = state.hoursDraft;
  if (!times) return;
  button.disabled = true;
  button.textContent = 'Envoi…';
  try {
    const res = await api('admin.settings', { bookingTimes: times });
    if (!res.ok) {
      if (res.error === 'auth') return logout('Session expirée : entrez à nouveau votre code.');
      throw new Error();
    }
    // Un script Google pas encore mis à jour ne connaît pas ce réglage.
    if (!Array.isArray(res.bookingTimes)) throw new Error('script');
    state.bookingTimes = res.bookingTimes;
    state.hoursDraft = null;
    toast(res.bookingTimes.length ? `Enregistré : le site propose maintenant ${res.bookingTimes.map(timeLabel).join(', ')}.` : 'Enregistré : plus aucune heure proposée en ligne.');
  } catch {
    toast('Les heures n’ont pas pu être enregistrées. Réessayez.', true);
  }
  render();
}

// ------------------------------------------------------------------ fiche

function emptyDetail() {
  return `<div class="placeholder"><svg class="placeholder__logo" aria-hidden="true"><use href="#logo"/></svg><p>Choisissez une demande ou un rendez-vous pour voir la fiche.</p></div>`;
}

function backLabel() {
  if (state.sub) return 'Fiche';
  return TABS.find((t) => t.id === state.tab).label;
}

function detailPane(r) {
  const head = `<div class="dhead">
      <button type="button" class="back" data-action="back">${icon('i-back')}<span>${backLabel()}</span></button>
    </div>`;
  if (state.sub === 'propose') return head + proposeView(r);
  if (state.sub === 'refuse' || state.sub === 'cancel') return head + refuseView(r);
  const s = statusOf(r);
  let when;
  if (r.appointment) {
    const d = new Date(r.appointment);
    const start = hhmmOf(d);
    when = `<p class="when__day">${esc(dayName(ymdOf(d)))}${dayName(ymdOf(d)) !== fullDay(ymdOf(d)) ? `, ${esc(fmtDay.format(d))}` : ''}</p>
      <p class="when__time num">${timeLabel(start)} – ${timeLabel(plusMinutes(start, r.minutes || 30))}</p>`;
  } else {
    when = `<p class="when__day">Souhait du patient</p>
      <p class="when__time">${r.wishDate ? esc(fullDay(r.wishDate)) : 'Pas de date'}${r.moment && r.moment !== 'Peu importe' ? `, ${esc(r.moment.toLowerCase())}` : ''}</p>`;
  }
  const received = r.received ? new Date(r.received) : null;
  return `${head}
    <article class="fiche" id="r-${esc(r.id)}">
      <div class="fiche__top">${pill(s)}<span class="fiche__care">${esc(r.care)}</span></div>
      <h2 class="fiche__name">${esc(r.name)}</h2>
      <div class="when">${when}</div>
      <div class="contact">
        <a class="cbtn" href="${telUrl(r.phone)}">${icon('i-phone')}<span>Appeler</span></a>
        <a class="cbtn" href="${mapsUrl(r)}" target="_blank" rel="noopener">${icon('i-pin')}<span>Itinéraire</span></a>
        ${r.email ? `<a class="cbtn" href="mailto:${esc(r.email)}">${icon('i-mail')}<span>E-mail</span></a>` : ''}
      </div>
      <dl class="kv">
        <div><dt>Adresse</dt><dd>${esc(r.address)}<br>${esc(place(r))}</dd></div>
        <div><dt>Téléphone</dt><dd class="num">${esc(r.phone)}</dd></div>
        <div><dt>E-mail</dt><dd>${r.email ? esc(r.email) : '<span class="dash">Pas d’e-mail : prévenez-le par téléphone</span>'}</dd></div>
        ${received ? `<div><dt>Demande reçue</dt><dd>${esc(dayName(ymdOf(received)))} à ${timeOf(received)}</dd></div>` : ''}
      </dl>
      ${r.access ? `<div class="memo"><h3>Indications pour venir</h3><p>${esc(r.access)}</p></div>` : ''}
      ${r.message ? `<div class="memo"><h3>Précisions du patient</h3><p>${esc(r.message)}</p></div>` : ''}
      ${r.status === 'Horaire proposé' ? '<p class="note">Le patient a reçu votre proposition par e-mail. Il peut l’accepter ou la refuser.</p>' : ''}
    </article>
    ${actionsFor(r)}`;
}

function actionsFor(r) {
  const id = esc(r.id);
  if (r.status === 'En attente' && r.appointment && isFuture(r)) {
    return `<div class="actions">
      <button type="button" class="btn btn--primary" data-action="valider" data-id="${id}">Confirmer ${esc(timeOf(new Date(r.appointment)))}</button>
      <div class="actions__row">
        <button type="button" class="btn" data-action="sub" data-sub="propose">Autre horaire</button>
        <button type="button" class="btn" data-action="sub" data-sub="refuse">Refuser</button>
      </div>
    </div>`;
  }
  if (r.status === 'En attente') {
    return `<div class="actions">
      <button type="button" class="btn btn--primary" data-action="sub" data-sub="propose">Fixer un horaire</button>
      <div class="actions__row">
        <a class="btn" href="${telUrl(r.phone)}">Appeler d’abord</a>
        <button type="button" class="btn" data-action="sub" data-sub="refuse">Refuser</button>
      </div>
    </div>`;
  }
  if (LIVE.includes(r.status) && isFuture(r)) {
    return `<div class="actions">
      <div class="actions__row">
        <button type="button" class="btn" data-action="sub" data-sub="propose">Déplacer</button>
        <button type="button" class="btn" data-action="sub" data-sub="cancel">Annuler</button>
      </div>
    </div>`;
  }
  return '';
}

// ------------------------------------------------------------------ autre horaire / refus

function newForm(r, kind) {
  if (kind !== 'propose') return { kind, message: '' };
  const today = ymdOf(new Date());
  let date = r.appointment ? ymdOf(new Date(r.appointment)) : r.wishDate || addDays(today, 1);
  if (date < today) date = today;
  if (date > addDays(today, DAYS_SHOWN - 1)) date = addDays(today, DAYS_SHOWN - 1);
  return { kind, date, minutes: r.minutes || 30, time: '', agreed: r.status === 'Confirmé' || !r.email, message: '' };
}

function proposeView(r) {
  const f = state.form;
  const info = state.days[`${f.date}|${f.minutes}|${r.eventId || ''}`];
  const moving = r.status === 'Confirmé' || r.status === 'Horaire proposé';
  let slots = '<p class="hint">Chargement des horaires libres…</p>';
  if (info && info.error) slots = '<p class="hint">Impossible de charger les horaires. Tapez une heure ci-dessous.</p>';
  else if (info)
    slots = info.free.length
      ? `<div class="slots">${info.free.map((t) => `<button type="button" class="slot num" data-time="${t}" aria-pressed="${t === f.time}">${timeLabel(t)}</button>`).join('')}</div>`
      : '<p class="hint">Aucun horaire libre ce jour-là. Choisissez un autre jour ou tapez une heure.</p>';
  const label = f.time
    ? `${f.agreed ? (moving ? 'Déplacer à' : 'Confirmer') : 'Proposer'} ${dayName(f.date, false).toLowerCase()} à ${timeLabel(f.time)}`
    : 'Choisissez un horaire';
  return `<div class="form">
      <h2 class="form__title">${moving ? 'Déplacer le rendez-vous' : r.appointment ? 'Proposer un autre horaire' : 'Fixer un horaire'}</h2>
      <p class="form__who">${esc(r.name)} · ${esc(r.care)} · ${esc(place(r))}</p>
      <div class="field">
        <p class="field__label">Jour</p>
        ${dayStrip(f.date, 'form-day')}
      </div>
      <div class="field">
        <p class="field__label" id="dur-label">Durée</p>
        <div class="seg" role="group" aria-labelledby="dur-label">${[15, 30, 45, 60, 90].map((m) => `<button type="button" data-minutes="${m}" aria-pressed="${m === f.minutes}">${m} min</button>`).join('')}</div>
      </div>
      <div class="field">
        <p class="field__label">Horaires libres, ${esc(dayName(f.date).toLowerCase())}</p>
        ${slots}
      </div>
      <div class="field">
        <label class="field__label" for="f-time">Ou une autre heure</label>
        <input class="input num" id="f-time" type="time" step="300" min="07:00" max="19:00" value="${f.time}" data-field="time">
      </div>
      <div class="setrow setrow--inline">
        <div>
          <p class="setrow__title" id="agreed-label">Déjà convenu avec le patient</p>
          <p class="setrow__hint">${f.agreed ? 'Le rendez-vous est confirmé directement.' : r.email ? 'Le patient reçoit un e-mail pour accepter ou refuser.' : 'Pas d’e-mail : appelez le patient avant.'}</p>
        </div>
        <button type="button" class="switch" role="switch" aria-checked="${f.agreed}" aria-labelledby="agreed-label" data-action="agreed"><span></span></button>
      </div>
      <div class="field">
        <label class="field__label" for="f-msg">Message pour le patient <span>facultatif</span></label>
        <textarea class="input" id="f-msg" rows="2" data-field="message">${esc(f.message)}</textarea>
      </div>
    </div>
    <div class="actions">
      <button type="button" class="btn btn--primary" data-action="proposer" data-id="${esc(r.id)}"${f.time ? '' : ' disabled'}>${esc(label)}</button>
    </div>`;
}

const REASONS = {
  refuse: ['Je suis complète ce jour-là. Appelez-moi pour trouver un autre jour.', 'Ce soin demande d’en parler d’abord : appelez-moi.'],
  cancel: ['J’ai un empêchement. Appelez-moi pour fixer un autre jour.'],
};

function refuseView(r) {
  const f = state.form;
  const refuse = f.kind === 'refuse';
  return `<div class="form">
      <h2 class="form__title">${refuse ? 'Refuser la demande' : 'Annuler le rendez-vous'}</h2>
      <p class="form__who">${esc(r.name)} · ${esc(r.care)}${r.appointment ? ` · ${esc(dayName(ymdOfItem(r), false).toLowerCase())} à ${timeOf(new Date(r.appointment))}` : ''}</p>
      <div class="field">
        <label class="field__label" for="f-msg">Message pour le patient <span>facultatif</span></label>
        <textarea class="input" id="f-msg" rows="3" data-field="message">${esc(f.message)}</textarea>
        <div class="quick">${REASONS[f.kind].map((t, i) => `<button type="button" class="quick__btn" data-reason="${i}">${esc(t)}</button>`).join('')}</div>
      </div>
      <p class="hint">${r.email ? 'Le patient est prévenu par e-mail' : 'Pas d’e-mail : pensez à appeler le patient'}${r.appointment ? ', et le créneau est libéré dans votre agenda.' : '.'}</p>
    </div>
    <div class="actions">
      <button type="button" class="btn btn--danger" data-action="${refuse ? 'refuser' : 'annuler'}" data-id="${esc(r.id)}">${refuse ? 'Refuser la demande' : 'Annuler le rendez-vous'}</button>
    </div>`;
}

// ------------------------------------------------------------------ connexion

function renderLogin(message = '') {
  app.innerHTML = `
    <main class="login">
      <svg class="login__logo" aria-hidden="true"><use href="#logo"/></svg>
      <h1>Mes rendez-vous</h1>
      <p class="login__sub">Isabelle Buisson, infirmière libérale</p>
      <form class="login__form" data-form="login">
        <label for="code">Code</label>
        <input class="input" id="code" name="code" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" minlength="6" maxlength="64" required aria-describedby="code-hint">
        <p class="login__hint" id="code-hint">Chiffres et lettres acceptés. Attention aux majuscules.</p>
        <p class="login__error" role="alert">${esc(message)}</p>
        <button class="btn btn--primary" type="submit">Entrer</button>
      </form>
      <p class="login__foot">${DEMO ? `Démonstration : le code est ${DEMO_CODE}.` : 'Ce téléphone restera connecté.'}</p>
    </main>`;
  setTimeout(() => document.getElementById('code')?.focus(), 50);
}

// ------------------------------------------------------------------ navigation (bouton retour du téléphone compris)

function routeFromHash() {
  const [id, sub] = decodeURIComponent(location.hash.slice(1)).split('/');
  const subs = { horaire: 'propose', refus: 'refuse', annulation: 'cancel' };
  return { id: id || null, sub: subs[sub] || null };
}
function hashFor(id, sub) {
  const names = { propose: 'horaire', refuse: 'refus', cancel: 'annulation' };
  return id ? `#${id}${sub ? `/${names[sub]}` : ''}` : location.pathname + location.search;
}

function go(id, sub = null) {
  if (!state.open && id) state.listScroll = window.scrollY;
  const r = id && state.items.find((i) => i.id === id);
  state.form = sub && r ? newForm(r, sub) : null;
  state.open = id;
  state.sub = sub;
  state.anim = 'detail';
  history.pushState(null, '', hashFor(id, sub));
  state.pushed += 1;
  render();
  window.scrollTo(0, 0);
}

function back() {
  if (state.pushed > 0) {
    history.back(); // popstate s'occupe du reste
    return;
  }
  // Ouvert depuis le lien d'un e-mail : on remonte d'un cran sans quitter la page.
  const sub = state.sub;
  state.sub = null;
  state.form = null;
  if (!sub) state.open = null;
  history.replaceState(null, '', hashFor(state.open, null));
  render();
  if (!state.open) window.scrollTo(0, state.listScroll);
}

window.addEventListener('popstate', () => {
  state.pushed = Math.max(0, state.pushed - 1);
  const { id, sub } = routeFromHash();
  const wasOpen = state.open;
  state.open = id;
  if (sub !== state.sub) {
    const r = id && state.items.find((i) => i.id === id);
    state.form = sub && r ? newForm(r, sub) : null;
  }
  state.sub = sub;
  state.anim = id ? 'detail' : 'list';
  render();
  window.scrollTo(0, !id && wasOpen ? state.listScroll : 0);
});

// Ouvre la fiche demandée par le lien de l'e-mail (#id). Essayé à chaque chargement jusqu'à
// ce que la demande soit trouvée (une demande toute récente n'est pas encore dans la copie locale).
function openFromHash() {
  if (state.hashDone) return;
  const { id, sub } = routeFromHash();
  if (!id) {
    state.hashDone = true;
    return;
  }
  const r = state.items.find((i) => i.id === id);
  if (!r) return;
  state.hashDone = true;
  const g = groups();
  state.tab = [...g.toConfirm, ...g.toCall, ...g.waiting].includes(r) ? 'todo' : g.upcoming.includes(r) ? 'plan' : 'history';
  if (state.tab === 'plan') state.planDay = ymdOfItem(r);
  state.open = id;
  state.sub = sub;
  state.form = sub ? newForm(r, sub) : null;
}

// ------------------------------------------------------------------ données

// Copie de la dernière liste sur le téléphone : la page s'affiche tout de suite à l'ouverture,
// puis se met à jour dès que Google répond. Effacée à la déconnexion.
const CACHE_KEY = 'rdv.cache';
function saveCache() {
  if (DEMO) return;
  write(CACHE_KEY, JSON.stringify({ items: state.items, autoConfirm: state.autoConfirm, bookingTimes: state.bookingTimes, at: state.updatedAt.toISOString() }));
}
function restoreCache() {
  try {
    const c = JSON.parse(read(CACHE_KEY) || 'null');
    if (!c || !Array.isArray(c.items)) return;
    state.items = c.items;
    state.autoConfirm = !!c.autoConfirm;
    if (Array.isArray(c.bookingTimes)) state.bookingTimes = c.bookingTimes;
    const at = new Date(c.at);
    state.updatedAt = isNaN(at) ? null : at;
    state.loaded = true;
  } catch {
    /* copie illisible : on attend Google */
  }
}

async function load(quiet = false) {
  if (!state.token) return render();
  if (!quiet) {
    state.busy = true;
    if (state.loaded) render();
  }
  try {
    const res = await api('admin.list');
    if (!res.ok) {
      if (res.error === 'auth') return logout('Session expirée : entrez à nouveau votre code.');
      throw new Error(res.message || res.error);
    }
    state.items = res.items;
    state.autoConfirm = !!res.autoConfirm;
    if (Array.isArray(res.bookingTimes)) state.bookingTimes = res.bookingTimes;
    state.error = '';
    state.updatedAt = new Date();
    saveCache();
  } catch {
    state.error = `Google n’a pas répondu${state.updatedAt ? ` (liste à jour à ${timeOf(state.updatedAt)})` : ''}. Vérifiez la connexion internet, puis réessayez.`;
  } finally {
    state.loaded = true;
    state.busy = false;
  }
  openFromHash();
  state.days = {};
  render();
}

// Horaires libres d'un jour (pour la journée du planning et pour « autre horaire »).
async function ensureDay(ymd, forForm = false) {
  const r = forForm && state.items.find((i) => i.id === state.open);
  const minutes = forForm ? state.form.minutes : CONFIG.step;
  const key = forForm ? `${ymd}|${minutes}|${(r && r.eventId) || ''}` : ymd;
  if (key in state.days) return; // déjà chargé ou en cours
  state.days[key] = null;
  let entry;
  try {
    const res = await api('admin.slots', { date: ymd, commune: forForm && r ? r.commune : '', ignoreId: forForm && r ? r.eventId : '', minutes });
    if (!res.ok) throw new Error();
    entry = { free: res.times };
  } catch {
    entry = { free: [], error: true };
  }
  state.days[key] = entry;
  // On ne redessine que si l'écran montre encore ce jour-là.
  if ((forForm && state.sub === 'propose' && state.form && state.form.date === ymd) || (!forForm && state.tab === 'plan' && state.planDay === ymd)) render();
}

function logout(message = '') {
  state.token = '';
  state.items = [];
  state.loaded = false;
  state.open = null;
  state.sub = null;
  state.updatedAt = null;
  write(TOKEN_KEY, '');
  write(CACHE_KEY, ''); // la copie des rendez-vous ne reste pas sur un téléphone déconnecté
  history.replaceState(null, '', location.pathname + location.search);
  renderLogin(message);
}

async function decide(id, choice, extra = {}) {
  const buttons = [...app.querySelectorAll('.btn')];
  buttons.forEach((b) => (b.disabled = true));
  const main = buttons.find((b) => b.dataset.action === choice || (choice === 'proposer' && b.dataset.action === 'proposer'));
  if (main) main.textContent = 'Envoi…';
  const backToCard = () => {
    if (state.sub && state.pushed > 0) history.back();
    else {
      state.sub = null;
      state.form = null;
      history.replaceState(null, '', hashFor(id, null));
    }
  };
  try {
    const res = await api('admin.decide', { id, choice, ...extra });
    if (!res.ok) {
      if (res.error === 'auth') return logout('Session expirée : entrez à nouveau votre code.');
      toast(cap(res.message || 'L’action n’a pas pu être faite.'), true);
      // La demande a pu changer entre-temps (autre page, réponse du patient) : on remet la fiche à jour.
      if (/déjà traitée|n’existe plus/.test(res.message || '')) {
        backToCard();
        await load(true);
      } else render();
      return;
    }
    toast(res.message);
    backToCard(); // retour à la fiche, mise à jour
    await load(true);
  } catch {
    // Google n'a pas répondu malgré les nouveaux essais : on regarde où en est la demande.
    toast('Google met du temps à répondre. La fiche est remise à jour : vérifiez si c’est passé avant de réessayer.', true);
    backToCard();
    await load(true);
  }
}

// ------------------------------------------------------------------ événements

app.addEventListener('submit', async (e) => {
  if (e.target.dataset.form !== 'login') return;
  e.preventDefault();
  const code = e.target.code.value.trim();
  const button = e.target.querySelector('button');
  button.disabled = true;
  try {
    const res = await api('admin.login', { code });
    if (!res.ok) {
      const messages = {
        code: res.left ? `Code incorrect. Encore ${plural(res.left, 'essai', 'essais')} avant un blocage.` : 'Code incorrect.',
        locked: `Trop d’essais. Réessayez dans ${res.minutes >= 60 ? `${Math.round(res.minutes / 60)} h` : `${res.minutes || 15} minutes`}.`,
        nocode: 'Le code n’est pas encore réglé dans le script Google (CODE_GESTION).',
        weak: 'Le code réglé dans le script Google est trop court : au moins 6 chiffres, ou 8 caractères s’il contient des lettres.',
      };
      renderLogin(messages[res.error] || 'Connexion impossible.');
      return;
    }
    state.token = res.token;
    write(TOKEN_KEY, res.token);
    state.loaded = false;
    render();
    load();
  } catch {
    renderLogin('Pas de connexion internet.');
  }
});

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action], [data-tab], [data-open], [data-time], [data-plan-day], [data-form-day], [data-minutes], [data-reason], [data-hour]');
  if (!el) return;
  const d = el.dataset;
  if (d.hour) {
    const sel = new Set(state.hoursDraft || state.bookingTimes);
    if (sel.has(d.hour)) sel.delete(d.hour);
    else sel.add(d.hour);
    state.hoursDraft = GRID.filter((t) => sel.has(t));
    return render();
  }
  if (d.tab) {
    state.tab = d.tab;
    state.open = null;
    state.sub = null;
    state.form = null;
    state.pushed = 0;
    history.replaceState(null, '', location.pathname + location.search);
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (d.open) return go(d.open);
  if (d.planDay) {
    state.planDay = d.planDay;
    if (WIDE.matches) state.open = null; // la fiche suit le jour choisi
    return render();
  }
  const f = state.form;
  if (d.formDay && f) {
    f.date = d.formDay;
    f.time = '';
    return render();
  }
  if (d.minutes && f) {
    f.minutes = Number(d.minutes);
    f.time = '';
    return render();
  }
  if (d.time && f) {
    f.time = d.time;
    return render();
  }
  if (d.reason && f) {
    f.message = REASONS[f.kind][Number(d.reason)];
    const box = document.getElementById('f-msg');
    if (box) box.value = f.message;
    return;
  }
  const r = state.open && state.items.find((i) => i.id === state.open);
  switch (d.action) {
    case 'refresh':
      state.days = {};
      return load();
    case 'logout':
      return logout();
    case 'back':
      return back();
    case 'sub':
      return go(state.open, d.sub);
    case 'agreed':
      f.agreed = !f.agreed;
      return render();
    case 'auto':
      return toggleAuto();
    case 'save-hours':
      return saveHours(el);
    case 'reset-hours':
      state.hoursDraft = null;
      return render();
    case 'valider':
      return decide(d.id, 'valider');
    case 'refuser':
    case 'annuler':
      return decide(d.id, d.action, { message: f ? f.message : '' });
    case 'proposer':
      if (!r || !f || !f.time) return toast('Choisissez un horaire libre ou tapez une heure.', true);
      return decide(d.id, 'proposer', { date: f.date, time: f.time, minutes: f.minutes, agreed: f.agreed, message: f.message });
    default:
  }
});

app.addEventListener('input', (e) => {
  const name = e.target.dataset.field;
  if (name === 'message' && state.form) state.form.message = e.target.value;
});
app.addEventListener('change', (e) => {
  const name = e.target.dataset.field;
  if (name === 'time' && state.form) {
    state.form.time = e.target.value;
    render();
  }
});

function toggleAuto() {
  const next = !state.autoConfirm;
  state.autoConfirm = next;
  render();
  api('admin.settings', { autoConfirm: next })
    .then((res) => {
      if (!res.ok) throw new Error();
      state.autoConfirm = !!res.autoConfirm;
      toast(next ? 'Confirmation automatique activée.' : 'Confirmation automatique désactivée.');
      render();
    })
    .catch(() => {
      state.autoConfirm = !next;
      toast('Le réglage n’a pas pu être enregistré.', true);
      render();
    });
}

// Mise à jour quand elle revient sur la page, et toutes les deux minutes (sauf pendant une saisie).
const idle = () => document.visibilityState === 'visible' && state.token && !state.sub;
document.addEventListener('visibilitychange', () => idle() && load()); // à la réouverture : « Mise à jour… » visible
setInterval(() => idle() && load(true), 120000);

if (state.token && !DEMO) {
  restoreCache();
  openFromHash();
}
render();
load();

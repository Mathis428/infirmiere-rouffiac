// Prise de rendez-vous en ligne. Chaque demande est validée par Isabelle.
// - Prise de sang, pansement simple, retrait de points ou d'agrafes (moins de 10), vaccination
//   (plus de 11 ans), dans l'une des 4 communes : la personne choisit un créneau de 30 minutes.
// - Autres soins, ou autre commune : demande, Isabelle rappelle pour fixer le rendez-vous.
import { buildDemoDays, dayParts, longDate, timeLabel, parisIsoDay } from './slots.js';
import { callScript } from './gas.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(?:(?:\+|00)33[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;
const VISIBLE_DAYS = 9;
const CONDITIONS = {
  retrait: { field: 'checkRetrait', error: 'Le retrait en ligne concerne moins de 10 points ou agrafes. Sinon, choisissez « Autre soin ».' },
  vaccin: { field: 'checkVaccin', error: 'La vaccination en ligne concerne les personnes de plus de 11 ans. Sinon, appelez-moi.' },
};

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const checked = (form, name) => form.querySelector(`input[name="${name}"]:checked`)?.value || '';

export function initBooking(root, config) {
  if (!root) return;
  const demo = !config.endpoint;
  root.querySelectorAll('[data-demo-note]').forEach((el) => (el.hidden = !demo));

  const form = root.querySelector('[data-form="book"]');
  const done = root.querySelector('[data-done]');

  // Réveil anticipé : après un moment sans visite, Google peut mettre 20 secondes à relancer le
  // script. Dès que le formulaire approche de l'écran (ou qu'on le touche), on le réveille en
  // arrière-plan, pour que les créneaux arrivent vite une fois le soin et la commune choisis.
  if (!demo) {
    let awake = false;
    const wake = () => {
      if (awake) return;
      awake = true;
      callScript(config.endpoint, { start: 1, tries: 1, total: 30000 }).catch(() => {});
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          wake();
        }
      }, { rootMargin: '600px 0px' });
      io.observe(form);
    }
    form.addEventListener('pointerdown', wake, { once: true });
    form.addEventListener('focusin', wake, { once: true });
  }
  const status = form.querySelector('[data-status]');
  const submit = form.querySelector('[data-submit]');
  const hint = form.querySelector('[data-mode-hint]');
  const slotsBlock = form.querySelector('[data-mode="slots"]');
  const requestBlock = form.querySelector('[data-mode="request"]');
  const requestIntro = form.querySelector('[data-request-intro]');
  const fineSlots = form.querySelector('[data-fine-slots]');
  const daysEl = form.querySelector('[data-days]');
  const timesEl = form.querySelector('[data-times]');
  const moreButton = form.querySelector('[data-more-days]');
  const wish = form.querySelector('[data-min-tomorrow]');

  linkErrors(form);

  // Date souhaitée : à partir de demain.
  if (wish) {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    wish.min = t.toISOString().slice(0, 10);
  }

  let days = [];
  let loadedFor = '';
  let showAll = false;

  const careInput = () => form.querySelector('input[name="care"]:checked');
  const isSlotCare = () => !!careInput()?.hasAttribute('data-slot');
  const condition = () => careInput()?.dataset.condition || '';
  const freeTimes = (day) => (day.open ? day.times : []);

  function mode() {
    const care = checked(form, 'care');
    const commune = checked(form, 'commune');
    if (!care || !commune) return null;
    return isSlotCare() && config.communes.includes(commune) ? 'slots' : 'request';
  }

  function applyMode() {
    const m = mode();
    hint.hidden = !!m;
    slotsBlock.hidden = slotsBlock.disabled = m !== 'slots';
    requestBlock.hidden = requestBlock.disabled = m !== 'request';
    fineSlots.hidden = m !== 'slots';
    submit.textContent = m === 'slots' ? 'Demander ce rendez-vous' : m === 'request' ? 'Envoyer ma demande' : 'Envoyer';
    form.querySelectorAll('[data-condition-box]').forEach((box) => {
      box.hidden = m !== 'slots' || box.dataset.conditionBox !== condition();
    });
    if (m === 'request') {
      requestIntro.textContent = isSlotCare()
        ? 'La réservation en ligne de ce soin concerne Saint-Bauzile, Balsièges, Brenoux et Lanuéjols. Envoyez votre demande : je vous rappelle pour voir ce qui est possible.'
        : 'Je vous rappelle au plus tôt pour fixer, avec vous, un rendez-vous.';
    }
    // Jours où la réservation en ligne est ouverte (config.bookingDays ; aujourd'hui tous les jours).
    const closedNow = m === 'slots' && !config.bookingDays.includes(parisIsoDay());
    submit.disabled = closedNow;
    if (closedNow) {
      daysEl.innerHTML = `<p class="notice">La réservation en ligne n’est pas possible le samedi et le dimanche. Appelez-moi au <a href="${config.phoneHref}">${config.phone}</a>, ou revenez à partir de lundi.</p>`;
      timesEl.innerHTML = '';
      moreButton.hidden = true;
      loadedFor = '';
      return;
    }
    if (m === 'slots') loadDays();
  }

  // Les horaires libres dépendent de la commune (trajets) et du nombre de personnes.
  async function loadDays(force = false) {
    const key = checked(form, 'commune');
    if (!force && key === loadedFor) return;
    loadedFor = key;
    daysEl.innerHTML = '<p class="hint">Chargement des disponibilités…</p>';
    timesEl.innerHTML = '';
    try {
      days = demo ? buildDemoDays(config) : await fetchDays(config.endpoint, key);
      if (key !== loadedFor) return;
      renderDays();
    } catch {
      loadedFor = '';
      daysEl.innerHTML = `<p class="notice">Les disponibilités n’ont pas pu être chargées. Appelez le <a href="${config.phoneHref}">${config.phone}</a>.</p>`;
    }
  }

  function renderDays() {
    const selected = checked(form, 'date');
    const list = showAll ? days : days.slice(0, VISIBLE_DAYS);
    if (!list.length) {
      daysEl.innerHTML = `<p class="notice">Aucune date ouverte pour le moment. Appelez le <a href="${config.phoneHref}">${config.phone}</a>.</p>`;
    } else {
      daysEl.replaceChildren(
        ...list.map((day) => {
          const p = dayParts(day.date);
          const free = freeTimes(day).length;
          const note = free === 0 ? (day.open ? 'complet' : 'fermé') : free === 1 ? '1 horaire' : `${free} horaires`;
          const input = Object.assign(document.createElement('input'), {
            type: 'radio',
            name: 'date',
            value: day.date,
            disabled: free === 0,
            checked: free > 0 && day.date === selected,
          });
          input.setAttribute('aria-label', `${capitalize(longDate(day.date))}, ${note}`);
          return choice(input, `<b>${p.weekdayShort} ${p.day} ${p.monthShort}</b><small>${note}</small>`, 'choice--day');
        }),
      );
    }
    moreButton.hidden = showAll || days.length <= VISIBLE_DAYS;
    renderTimes();
  }

  function renderTimes() {
    const day = days.find((d) => d.date === checked(form, 'date'));
    if (!day) {
      timesEl.innerHTML = '<p class="hint">Choisissez d’abord un jour.</p>';
      return;
    }
    const selected = checked(form, 'time');
    timesEl.replaceChildren(
      ...freeTimes(day).map((time) => {
        const input = Object.assign(document.createElement('input'), {
          type: 'radio',
          name: 'time',
          value: time,
          checked: time === selected,
        });
        input.setAttribute('aria-label', timeLabel(time));
        return choice(input, `<b>${timeLabel(time)}</b>`, 'choice--time');
      }),
    );
  }

  form.addEventListener('change', (e) => {
    const { name } = e.target;
    if (name === 'care' || name === 'commune') {
      clearError(form, name);
      applyMode();
    }
    if (name === 'checkRetrait' || name === 'checkVaccin') clearError(form, 'condition');
    if (name === 'date') {
      renderTimes();
      clearError(form, 'day');
    }
    if (name === 'time') clearError(form, 'time');
    if (name === 'consent') clearError(form, 'consent');
  });
  form.addEventListener('input', (e) => e.target.name && clearError(form, e.target.name));

  moreButton.addEventListener('click', () => {
    showAll = true;
    renderDays();
    daysEl.querySelectorAll('input')[VISIBLE_DAYS]?.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    const data = Object.fromEntries(new FormData(form));
    const m = mode();
    const errors = {};
    if (!data.care) errors.care = 'Choisissez le soin.';
    if (!data.commune) errors.commune = 'Choisissez votre commune.';
    if (m === 'slots') {
      const c = CONDITIONS[condition()];
      if (c && !data[c.field]) errors.condition = c.error;
      if (!data.date) errors.day = 'Choisissez un jour.';
      if (!data.time) errors.time = 'Choisissez une heure.';
    }
    if (!data.name || data.name.trim().length < 3) errors.name = 'Indiquez votre nom et votre prénom.';
    if (!PHONE_RE.test((data.phone || '').trim()))
      errors.phone = 'Indiquez un numéro de téléphone à 10 chiffres, par exemple 06 12 34 56 78.';
    if (data.email && !EMAIL_RE.test(data.email.trim())) errors.email = 'Cette adresse e-mail semble incomplète.';
    if (!data.address || data.address.trim().length < 4) errors.address = 'Indiquez l’adresse où je dois venir.';
    if (!data.consent) errors.consent = 'Cochez cette case pour envoyer votre demande.';
    showErrors(form, errors);
    if (Object.keys(errors).length) return;

    const common = {
      care: data.care,
      commune: data.commune === 'autre' ? 'Autre commune' : data.commune,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: (data.email || '').trim(),
      address: data.address.trim(),
      access: (data.access || '').trim(),
      message: (data.message || '').trim().slice(0, 500),
      consent: true,
      website: data.website || '',
    };
    const payload =
      m === 'slots'
        ? { action: 'book', ...common, date: data.date, time: data.time }
        : { action: 'callback', ...common, wishDate: data.wishDate || '', moment: data.moment || 'Peu importe' };

    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Envoi en cours…';
    try {
      const res = demo ? await fakeSend() : await send(config.endpoint, payload);
      if (!res || !res.ok) throw Object.assign(new Error('refused'), { code: res && res.error });
      status.textContent = '';
      showDone(payload);
    } catch (err) {
      if (err.code === 'weekend') {
        status.innerHTML = `La réservation en ligne n’est pas possible le samedi et le dimanche. Appelez le <a href="${config.phoneHref}">${config.phone}</a>.`;
      } else if (err.code === 'taken' || err.code === 'closed') {
        status.textContent =
          err.code === 'taken'
            ? 'Ce créneau vient d’être réservé par quelqu’un d’autre. Choisissez-en un autre.'
            : 'Ce jour n’est plus réservable en ligne. Choisissez une autre date ou appelez-moi.';
        await loadDays(true);
      } else {
        status.innerHTML = `L’envoi n’a pas fonctionné. Appelez le <a href="${config.phoneHref}">${config.phone}</a>.`;
      }
    } finally {
      submit.disabled = false;
      form.setAttribute('aria-busy', 'false');
    }
  });

  function showDone(p) {
    const demoNote = demo ? '<p class="demo-note">Démonstration : aucune demande n’a été envoyée.</p>' : '';
    const how = p.email
      ? `par e-mail à <strong>${escapeHtml(p.email)}</strong>, avec un rappel la veille`
      : `par téléphone au <strong>${escapeHtml(p.phone)}</strong>`;
    const what =
      p.action === 'book'
        ? `<p>${escapeHtml(p.care)}, à domicile<br>
            <strong>${escapeHtml(capitalize(longDate(p.date)))}, à ${timeLabel(p.time)}</strong><br>
            ${escapeHtml(p.address)}, ${escapeHtml(p.commune)}</p>
           <p>Je vous confirme ce rendez-vous ${how}. Si l’horaire ne m’est pas possible, je vous en propose un autre.</p>
           <p>À préparer : l’ordonnance et votre carte Vitale${p.care === 'Prise de sang' ? ', votre carte de mutuelle et, si le laboratoire vous les a remis, le kit ou les étiquettes' : ''}.</p>`
        : `<p>${escapeHtml(p.care)}, ${escapeHtml(p.commune)}.</p>
           <p>Je vous rappelle au plus tôt ${p.email ? `(ou je vous écris à <strong>${escapeHtml(p.email)}</strong>)` : `au <strong>${escapeHtml(p.phone)}</strong>`} pour fixer, avec vous, un rendez-vous.</p>`;
    done.innerHTML = `
      <h4 class="done__title">Demande envoyée</h4>
      ${what}
      <p>Si c’est pressé, appelez-moi au <a href="${config.phoneHref}">${config.phone}</a>. En cas d’urgence, composez le 15.</p>
      ${demoNote}
      <button type="button" class="textbutton" data-again>Faire une autre demande</button>`;
    form.hidden = true;
    done.hidden = false;
    done.focus();
    done.querySelector('[data-again]').addEventListener('click', () => {
      form.reset();
      loadedFor = '';
      showAll = false;
      applyMode();
      done.hidden = true;
      form.hidden = false;
      form.querySelector('input[name="care"]').focus();
    });
  }

  applyMode();
}

function choice(input, html, extraClass) {
  const label = document.createElement('label');
  label.className = `choice ${extraClass}`;
  const span = document.createElement('span');
  span.innerHTML = html;
  span.setAttribute('aria-hidden', 'true');
  label.append(input, span);
  return label;
}

// ------------------------------------------------------------------ erreurs

function linkErrors(form) {
  form.querySelectorAll('[data-error]').forEach((el) => {
    el.id = `err-${el.dataset.error}`;
    el.setAttribute('aria-live', 'polite');
  });
}

function fieldsFor(form, key) {
  const name = { day: 'date' }[key] || key;
  return [...form.querySelectorAll(`[name="${name}"]`)];
}

function showErrors(form, errors) {
  form.querySelectorAll('[data-error]').forEach((el) => {
    const message = errors[el.dataset.error];
    el.textContent = message || '';
    el.hidden = !message;
    fieldsFor(form, el.dataset.error).forEach((field) => {
      const ids = new Set((field.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      if (message) {
        field.setAttribute('aria-invalid', 'true');
        ids.add(el.id);
      } else {
        field.removeAttribute('aria-invalid');
        ids.delete(el.id);
      }
      if (ids.size) field.setAttribute('aria-describedby', [...ids].join(' '));
      else field.removeAttribute('aria-describedby');
    });
  });
  const first = Object.keys(errors)[0];
  if (first) {
    const field = fieldsFor(form, first).find((f) => !f.disabled) || form.querySelector(`[data-error="${first}"]`);
    field?.focus();
  }
}

function clearError(form, key) {
  const el = form.querySelector(`[data-error="${key}"]`);
  if (!el || el.hidden) return;
  el.hidden = true;
  el.textContent = '';
  fieldsFor(form, key).forEach((f) => f.removeAttribute('aria-invalid'));
}

// ------------------------------------------------------------------ envoi

const send = (endpoint, payload) => callScript(endpoint, { body: payload });

const fakeSend = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, demo: true }), 700));

async function fetchDays(endpoint, commune) {
  const params = new URLSearchParams({ action: 'slots', commune });
  const json = await callScript(`${endpoint}?${params}`);
  if (!json || !json.ok) throw new Error('slots');
  return json.days;
}

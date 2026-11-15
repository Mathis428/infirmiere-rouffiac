// Prise de rendez-vous en ligne, pour tous les soins.
// - Prise de sang dans l'une des 4 communes : réservation directe d'un créneau (règles d'Isabelle).
// - Autre soin, ou autre commune : demande en ligne, Isabelle rappelle pour fixer le jour et l'heure.
import { buildDemoDays, dayParts, longDate, timeLabel, endTime } from './slots.js';

const PHONE_RE = /^(?:(?:\+|00)33[\s.-]?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;
const VISIBLE_DAYS = 9;
const BLOOD = 'Prise de sang';

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
  let daysLoaded = false;
  let showAll = false;

  const people = () => Number(checked(form, 'people') || 1);
  const freeTimes = (day) => (day.open ? day.slots.filter((s) => (people() === 2 ? s.two : s.one)) : []);

  function mode() {
    const care = checked(form, 'care');
    const commune = checked(form, 'commune');
    if (!care || !commune) return null;
    return care === BLOOD && config.communes.includes(commune) ? 'slots' : 'request';
  }

  function applyMode() {
    const m = mode();
    hint.hidden = !!m;
    slotsBlock.hidden = slotsBlock.disabled = m !== 'slots';
    requestBlock.hidden = requestBlock.disabled = m !== 'request';
    fineSlots.hidden = m !== 'slots';
    submit.textContent = m === 'slots' ? 'Réserver ce créneau' : m === 'request' ? 'Envoyer ma demande' : 'Envoyer';
    if (m === 'request') {
      requestIntro.textContent =
        checked(form, 'care') === BLOOD
          ? 'La réservation directe des prises de sang concerne Saint-Bauzile, Balsièges, Brenoux et Lanuéjols. Envoyez votre demande : je vous rappelle pour voir ce qui est possible.'
          : 'Je vous rappelle pour fixer ensemble le jour et l’heure de mon passage.';
    }
    if (m === 'slots' && !daysLoaded) loadDays();
  }

  async function loadDays() {
    daysLoaded = true;
    daysEl.innerHTML = '<p class="hint">Chargement des disponibilités…</p>';
    timesEl.innerHTML = '';
    try {
      days = demo ? buildDemoDays(config) : await fetchDays(config.endpoint);
      renderDays();
    } catch {
      daysLoaded = false;
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
    const minutes = config.durations[people()];
    const free = new Set(freeTimes(day).map((s) => s.time));
    timesEl.replaceChildren(
      ...day.slots.map((slot) => {
        const ok = free.has(slot.time);
        const input = Object.assign(document.createElement('input'), {
          type: 'radio',
          name: 'time',
          value: slot.time,
          disabled: !ok,
          checked: ok && slot.time === selected,
        });
        const until = ok ? `jusqu’à ${timeLabel(endTime(slot.time, minutes))}` : 'déjà pris';
        input.setAttribute('aria-label', `${timeLabel(slot.time)}, ${until}`);
        return choice(input, `<b>${timeLabel(slot.time)}</b><small>${until}</small>`, 'choice--time');
      }),
    );
  }

  form.addEventListener('change', (e) => {
    const { name } = e.target;
    if (name === 'care' || name === 'commune') {
      clearError(form, name);
      applyMode();
    }
    if (name === 'people') renderDays();
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
      if (!data.date) errors.day = 'Choisissez un jour.';
      if (!data.time) errors.time = 'Choisissez une heure.';
    }
    if (!data.name || data.name.trim().length < 3) errors.name = 'Indiquez votre nom et votre prénom.';
    if (!PHONE_RE.test((data.phone || '').trim()))
      errors.phone = 'Indiquez un numéro de téléphone à 10 chiffres, par exemple 06 12 34 56 78.';
    if (!data.address || data.address.trim().length < 4) errors.address = 'Indiquez l’adresse où je dois venir.';
    if (!data.consent) errors.consent = 'Cochez cette case pour envoyer votre demande.';
    showErrors(form, errors);
    if (Object.keys(errors).length) return;

    const common = {
      care: data.care,
      commune: data.commune === 'autre' ? 'Autre commune' : data.commune,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
      access: (data.access || '').trim(),
      consent: true,
      website: data.website || '',
    };
    const payload =
      m === 'slots'
        ? { action: 'book', ...common, people: Number(data.people) === 2 ? 2 : 1, date: data.date, time: data.time }
        : {
            action: 'callback',
            ...common,
            wishDate: data.wishDate || '',
            moment: data.moment || 'Peu importe',
            message: (data.message || '').trim().slice(0, 500),
          };

    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    status.textContent = 'Envoi en cours…';
    try {
      const res = demo ? await fakeSend() : await send(config.endpoint, payload);
      if (!res || !res.ok) throw Object.assign(new Error('refused'), { code: res && res.error });
      status.textContent = '';
      showDone(payload);
    } catch (err) {
      if (err.code === 'taken' || err.code === 'closed') {
        status.textContent =
          err.code === 'taken'
            ? 'Ce créneau vient d’être réservé par quelqu’un d’autre. Choisissez-en un autre.'
            : 'Ce jour n’est plus réservable en ligne. Choisissez une autre date ou appelez-moi.';
        daysLoaded = false;
        await loadDays();
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
    if (p.action === 'book') {
      done.innerHTML = `
        <h4 class="done__title">C’est noté</h4>
        <p>Prise de sang à domicile<br>
          <strong>${escapeHtml(capitalize(longDate(p.date)))}, à ${timeLabel(p.time)}</strong><br>
          ${escapeHtml(p.address)}, ${escapeHtml(p.commune)}${p.people === 2 ? ' · 2 personnes' : ''}</p>
        <p>À préparer : l’ordonnance, votre carte Vitale, votre carte de mutuelle et, si le laboratoire vous les a remis, le kit ou les étiquettes.</p>
        <p>Pour annuler ou déplacer : <a href="${config.phoneHref}">${config.phone}</a>.</p>
        ${demoNote}
        <button type="button" class="textbutton" data-again>Faire une autre demande</button>`;
    } else {
      done.innerHTML = `
        <h4 class="done__title">Demande envoyée</h4>
        <p>${escapeHtml(p.care)}, ${escapeHtml(p.commune)}.</p>
        <p>Je vous rappelle au <strong>${escapeHtml(p.phone)}</strong> pour fixer ensemble le jour et l’heure de mon passage.</p>
        <p>Si c’est pressé, appelez-moi au <a href="${config.phoneHref}">${config.phone}</a>. En cas d’urgence, composez le 15.</p>
        ${demoNote}
        <button type="button" class="textbutton" data-again>Faire une autre demande</button>`;
    }
    form.hidden = true;
    done.hidden = false;
    done.focus();
    done.querySelector('[data-again]').addEventListener('click', () => {
      form.reset();
      daysLoaded = false;
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

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { ...options, redirect: 'follow', signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

const send = (endpoint, payload) =>
  request(endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });

const fakeSend = () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, demo: true }), 700));

async function fetchDays(endpoint) {
  const json = await request(`${endpoint}?action=slots`);
  if (!json || !json.ok) throw new Error('slots');
  return json.days;
}

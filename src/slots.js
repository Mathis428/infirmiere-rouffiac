// Calcul des jours et créneaux, à l'heure de Paris.
// En mode démonstration, le site calcule lui-même les créneaux (tous libres).
// Une fois relié à Google Agenda, c'est le script qui répond avec les créneaux réellement libres.

const TZ = 'Europe/Paris';

export function parisNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') };
}

const toYmd = (date) => date.toISOString().slice(0, 10);

export function buildDemoDays(config, now = parisNow()) {
  const days = [];
  for (let i = 1; i <= config.daysAhead; i++) {
    const date = new Date(Date.UTC(now.y, now.m - 1, now.d + i));
    const isoDay = ((date.getUTCDay() + 6) % 7) + 1;
    if (!config.weekdays.includes(isoDay)) continue;
    // Pour le lendemain, la réservation ferme la veille à l'heure limite.
    const open = i > 1 || now.h < config.cutoffHour;
    days.push({ date: toYmd(date), open, slots: config.slots.map((time) => ({ time, one: open, two: open })) });
  }
  return days;
}

function utcDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const fmt = (options) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...options });
const weekdayShort = fmt({ weekday: 'short' });
const weekdayLong = fmt({ weekday: 'long' });
const monthShort = fmt({ month: 'short' });
const monthLong = fmt({ month: 'long' });

export function dayParts(ymd) {
  const date = utcDate(ymd);
  return {
    weekdayShort: weekdayShort.format(date).replace('.', ''),
    weekdayLong: weekdayLong.format(date),
    day: date.getUTCDate(),
    monthShort: monthShort.format(date).replace('.', ''),
    monthLong: monthLong.format(date),
  };
}

export function longDate(ymd) {
  const p = dayParts(ymd);
  return `${p.weekdayLong} ${p.day === 1 ? '1er' : p.day} ${p.monthLong}`;
}

// '08:30' → '8 h 30'
export function timeLabel(time) {
  const [h, m] = time.split(':').map(Number);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function endTime(time, minutes) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

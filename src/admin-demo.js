// Fausses données pour essayer « Mes rendez-vous » en local, sans toucher au vrai agenda.
// Utilisé automatiquement sur localhost (ajouter ?live à l'adresse pour utiliser le vrai script).
import { gridTimes } from './slots.js';

export const DEMO_CODE = '123456';
const TOKEN = 'demo-token';

function at(dayOffset, time) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const ymd = (dayOffset) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
};

export function createDemoApi(config) {
  let autoConfirm = false;
  let bookingTimes = config.bookingTimes.slice();
  let n = 0;
  const item = (o) => ({
    id: `demo-${++n}`,
    received: at(-1, '18:12'),
    email: '',
    access: '',
    message: '',
    wishDate: '',
    moment: '',
    minutes: o.appointment ? 30 : null,
    eventId: o.appointment ? `ev-${n}` : null,
    ...o,
  });
  const items = [
    item({ status: 'En attente', care: 'Prise de sang', commune: 'Brenoux', name: 'Jeanne Martin', phone: '06 12 34 56 78', email: 'jeanne.martin@exemple.fr', address: '4 route du Bourg', access: 'Portail vert, sonner deux fois', message: 'À jeun, tubes fournis par le laboratoire.', appointment: at(1, '08:30') }),
    item({ status: 'En attente', care: 'Vaccination', commune: 'Balsièges', name: 'Paul Roux', phone: '07 98 76 54 32', address: '12 rue de l’Église', appointment: at(2, '14:00') }),
    item({ status: 'En attente', care: 'Pansement complexe', commune: 'Lanuéjols', name: 'Marie Fabre', phone: '04 66 00 11 22', address: 'Lieu-dit Le Mas', wishDate: ymd(3), moment: 'Matin', message: 'Pansement tous les deux jours pendant deux semaines.' }),
    item({ status: 'Confirmé', care: 'Pansement simple', commune: 'Saint-Bauzile', name: 'André Vidal', phone: '06 55 44 33 22', email: 'a.vidal@exemple.fr', address: '2 place de la Mairie', appointment: at(0, '17:30') }),
    item({ status: 'Confirmé', care: 'Prise de sang', commune: 'Saint-Bauzile', name: 'Germaine Bastide', phone: '04 66 48 12 30', address: '6 rue des Écoles', message: 'À jeun.', appointment: at(0, '09:30'), received: at(-3, '11:05') }),
    item({ status: 'Confirmé', care: 'Pansement simple', commune: 'Balsièges', name: 'Robert Chaptal', phone: '06 30 40 50 60', email: 'r.chaptal@exemple.fr', address: '1 impasse du Moulin', appointment: at(1, '14:30'), received: at(-2, '09:40') }),
    item({ status: 'Confirmé', care: 'Retrait de points ou d’agrafes', commune: 'Brenoux', name: 'Lucie Bonnet', phone: '06 11 22 33 44', address: '8 chemin des Prés', appointment: at(1, '10:00') }),
    item({ status: 'Horaire proposé', care: 'Injection', commune: 'Balsièges', name: 'Henri Pagès', phone: '06 70 80 90 10', email: 'h.pages@exemple.fr', address: '3 rue du Lot', appointment: at(2, '09:00') }),
    item({ status: 'Confirmé', care: 'Prise de sang', commune: 'Lanuéjols', name: 'Odette Rouvière', phone: '04 66 47 00 00', address: 'Route de Florac', appointment: at(-2, '08:00') }),
    item({ status: 'En attente', care: 'Vaccination', commune: 'Saint-Bauzile', name: 'Simone Atger', phone: '06 22 33 44 55', address: '5 rue du Four', appointment: at(-1, '10:00'), received: at(-4, '20:15') }),
    item({ status: 'Refusé', care: 'Soins post-opératoires', commune: 'Autre commune', name: 'Claude Brun', phone: '06 01 02 03 04', address: 'Rue Basse, Florac', wishDate: ymd(-1), moment: 'Après-midi' }),
  ];

  const wait = (v) => new Promise((resolve) => setTimeout(() => resolve(v), 350));
  const find = (id) => items.find((i) => i.id === id);
  const label = (iso) =>
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }).format(new Date(iso));

  return async function demoApi(action, p) {
    if (action === 'admin.login') {
      return wait(p.code === DEMO_CODE ? { ok: true, token: TOKEN } : { ok: false, error: 'code' });
    }
    if (p.token !== TOKEN) return wait({ ok: false, error: 'auth' });
    if (action === 'admin.list') return wait({ ok: true, items: structuredClone(items), autoConfirm, bookingTimes, now: new Date().toISOString() });
    if (action === 'admin.settings') {
      if (typeof p.autoConfirm === 'boolean') autoConfirm = p.autoConfirm;
      if (Array.isArray(p.bookingTimes)) bookingTimes = gridTimes(config).filter((t) => p.bookingTimes.includes(t));
      return wait({ ok: true, autoConfirm, bookingTimes });
    }
    if (action === 'admin.slots') {
      const taken = new Set(
        items
          .filter((i) => i.appointment && i.eventId !== p.ignoreId && ['Confirmé', 'En attente', 'Horaire proposé'].includes(i.status) && i.appointment.slice(0, 10) === p.date)
          .map((i) => new Date(i.appointment).toTimeString().slice(0, 5)),
      );
      // Faux agenda : ses tournées habituelles, tôt le matin et en fin de journée.
      const rounds = (t) => t < '08:30' || (t >= '12:00' && t < '13:30') || t >= '18:00';
      const now = new Date();
      return wait({
        ok: true,
        times: gridTimes(config).filter((t) => !taken.has(t) && !rounds(t) && new Date(`${p.date}T${t}:00`) > now),
      });
    }
    if (action === 'admin.decide') {
      const r = find(p.id);
      if (!r) return wait({ ok: false, error: 'missing', message: 'Cette demande n’existe plus.' });
      const informed = r.email ? 'Le patient a été prévenu par e-mail.' : `Pas d’e-mail : pensez à appeler le patient au ${r.phone}.`;
      if (p.choice === 'valider') {
        r.status = 'Confirmé';
        return wait({ ok: true, message: `Rendez-vous confirmé le ${label(r.appointment)}. ${informed}` });
      }
      if (p.choice === 'refuser') {
        r.status = 'Refusé';
        r.eventId = null;
        return wait({ ok: true, message: `Demande refusée. ${informed}` });
      }
      if (p.choice === 'annuler') {
        r.status = 'Annulé';
        r.eventId = null;
        return wait({ ok: true, message: `Rendez-vous annulé. ${informed}` });
      }
      if (p.choice === 'proposer') {
        r.appointment = new Date(`${p.date}T${p.time}:00`).toISOString();
        r.minutes = p.minutes;
        r.eventId = r.eventId || `ev-${++n}`;
        r.status = p.agreed ? 'Confirmé' : 'Horaire proposé';
        return wait({
          ok: true,
          message: p.agreed
            ? `Rendez-vous confirmé le ${label(r.appointment)}. ${informed}`
            : `Horaire proposé le ${label(r.appointment)}. ${r.email ? 'Le patient a reçu un lien pour accepter ou refuser.' : 'Pas d’e-mail : appelez le patient, puis revenez cocher « Déjà convenu ».'}`,
        });
      }
    }
    return wait({ ok: false, error: 'action' });
  };
}

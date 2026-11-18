// Échanges avec le script Google. Google répond d'habitude en 1 à 3 secondes, mais il arrive
// qu'une demande reste bloquée de son côté : on la relance alors automatiquement.
// Les envois portent une clé : si la première demande est finalement arrivée, le script le
// reconnaît et ne la traite pas une deuxième fois.

const newKey = () =>
  globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function callScript(url, { body = null, timeout = 12000, tries = 3 } = {}) {
  const key = body ? newKey() : null;
  let lastError = new Error('network');
  for (let i = 0; i < tries; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout + i * 6000);
    try {
      const res = await fetch(
        url,
        body
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ ...body, key }),
              redirect: 'follow',
              signal: controller.signal,
            }
          : { redirect: 'follow', signal: controller.signal },
      );
      return await res.json();
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

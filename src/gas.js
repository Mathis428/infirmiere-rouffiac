// Échanges avec le script Google.
// Le script répond en 1 à 2 secondes, mais Google laisse parfois traîner une requête plus de
// 25 secondes. On n'attend donc pas : si la réponse tarde, on envoie la même demande une
// deuxième fois (puis une troisième) en parallèle, et on garde la première réponse arrivée.
// Les envois portent une clé : le script reconnaît une demande déjà reçue et ne la traite
// jamais deux fois (voir once_ dans Code.gs).

const newKey = () =>
  globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function callScript(url, { body = null, hedge = body ? 5000 : 3500, tries = 3, total = 45000 } = {}) {
  const key = body ? newKey() : null;
  const init = () =>
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ ...body, key }),
          redirect: 'follow',
        }
      : { redirect: 'follow' };

  return new Promise((resolve, reject) => {
    const controllers = [];
    let started = 0;
    let failed = 0;
    let done = false;
    let lastError = new Error('network');
    let hedgeTimer = null;

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(hedgeTimer);
      clearTimeout(totalTimer);
      controllers.forEach((c) => c.abort());
      fn(value);
    };

    const launch = () => {
      if (done || started >= tries) return;
      clearTimeout(hedgeTimer);
      started += 1;
      const controller = new AbortController();
      controllers.push(controller);
      fetch(url, { ...init(), signal: controller.signal })
        .then((res) => res.json())
        .then((json) => finish(resolve, json))
        .catch((err) => {
          if (done) return;
          lastError = err;
          failed += 1;
          if (started < tries) launch(); // échec net : on relance tout de suite
          else if (failed >= started) finish(reject, lastError);
        });
      // Pas de réponse au bout de quelques secondes : on double la demande.
      hedgeTimer = setTimeout(launch, hedge * started);
    };

    const totalTimer = setTimeout(() => finish(reject, lastError), total);
    launch();
  });
}

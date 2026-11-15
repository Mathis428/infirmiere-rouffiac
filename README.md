# Site d’Isabelle Buisson, infirmière à domicile

Site vitrine d’une page, statique, hébergé sur GitHub Pages. Soins infirmiers à domicile dans le Valdonnez (Saint-Bauzile, Balsièges, Brenoux, Lanuéjols).

- Fiche praticien sobre, police Lato et rouge de sa carte de visite (#d8312e, dans `style.css` et `src/card-art.js`).
- Carte de visite en 3D (three.js) qu’on fait tourner, à côté du numéro de téléphone.
- Rendez-vous en ligne pour tous les soins : les prises de sang dans les quatre communes se réservent sur un créneau (8 h 30, 9 h, 9 h 30 ; 30 min ou 45 min pour deux personnes ; jusqu’à la veille 18 h) ; les autres demandes partent par e-mail et Isabelle rappelle.
- Aucun cookie, aucune mesure d’audience, polices hébergées sur le site.

## Arborescence

| Chemin | Rôle |
| --- | --- |
| `index.html` | La page |
| `mentions-legales.html` | Mentions légales, données personnelles, crédits photo |
| `assets/css/style.css` | Styles |
| `src/` | Scripts sources (à modifier ici) |
| `src/config.js` | Réglages : téléphone, adresse du script Google, créneaux, jours, heure limite |
| `assets/js/` | Scripts assemblés par `npm run build` (ne pas modifier à la main) |
| `assets/img/`, `assets/fonts/` | Images optimisées et polices |
| `google-agenda/` | Script Google Apps Script qui relie la réservation à Google Agenda, et son mode d’emploi |
| `tools/` | Outils : assemblage, serveur local, optimisation des images, export de la carte |

## Travailler sur le site

```bash
npm install
npm run serve    # http://localhost:4173
npm run watch    # reconstruit les scripts à chaque modification de src/
npm run build    # version finale, à lancer avant de publier
```

`npm run images` refait les images à partir des originaux du dossier `sources/` (non publié).
`node tools/export-card.mjs` (serveur local lancé) refait les images de la carte.

## Mettre en ligne

GitHub Pages publie la branche `main` à la racine. Après `npm run build`, faire un commit et pousser.

Pour le nom de domaine OVH : ajouter un fichier `CNAME` contenant le domaine, puis dans la zone DNS OVH les enregistrements indiqués par GitHub (Settings → Pages → Custom domain).

## Réservation en ligne

Tant que `endpoint` est vide dans `src/config.js`, le formulaire est en mode démonstration. Pour le relier à l’agenda Google d’Isabelle : `google-agenda/LISEZMOI.md`.

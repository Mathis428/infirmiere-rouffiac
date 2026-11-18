# Rendez-vous en ligne : installation et utilisation

Tant que ce n’est pas installé, le formulaire du site est en **mode démonstration** : on peut cliquer partout, mais rien n’est envoyé (un message l’indique).

## Ce que fait le système

1. Un patient fait une demande sur le site :
   - **prise de sang, pansement simple, retrait de points ou d’agrafes (moins de 10) ou vaccination (plus de 11 ans)**, dans l’une des 4 communes : il choisit un créneau libre de 30 minutes **du lundi au vendredi, à 7 h, 8 h 30, 9 h, 9 h 30, 10 h, 10 h 30, 17 h ou 17 h 30**. Il peut faire sa réservation n’importe quel jour, week-end compris (jusqu’à la veille 18 h). Les créneaux déjà pris dans l’agenda ne sont pas proposés ;
   - **autre soin** ou autre commune : il indique le jour et le moment souhaités, Isabelle le rappelle.
2. Isabelle reçoit un **e-mail** avec un lien « Valider, refuser ou proposer un autre horaire ». Pour un créneau choisi en ligne, l’horaire est déjà bloqué **en gris** dans son agenda (« ⏳ À confirmer »).
3. Sur la page du lien, elle choisit :
   - **Valider** : le rendez-vous passe **en rouge** dans l’agenda, le patient reçoit la confirmation ;
   - **Proposer un autre horaire** : le site vérifie que l’horaire ne chevauche pas un autre rendez-vous. Le patient reçoit un lien pour accepter ou refuser. Si elle a déjà convenu de l’heure au téléphone, elle coche « Déjà convenu » et c’est confirmé directement ;
   - **Refuser** : le créneau est libéré, le patient est prévenu.
4. **La veille à 17 h**, le patient reçoit un rappel.
5. Toutes les demandes sont listées dans un tableau Google Sheets **« Rendez-vous du site »**, dans son Google Drive.

Les e-mails partent de la boîte Gmail d’Isabelle (gratuit, jusqu’à 100 par jour). Un patient qui n’a pas donné d’e-mail est prévenu par **SMS** si l’option SMS est activée (payante, voir plus bas). Sinon, la page de gestion rappelle à Isabelle de l’appeler.

## 1. Installer le script (15 minutes, avec Isabelle)

1. Sur un ordinateur, connecté au **compte Google d’Isabelle**, ouvrir <https://script.google.com> → **Nouveau projet**. Le renommer `Rendez-vous site`.
2. Remplacer le contenu de `Code.gs` par tout le fichier `google-agenda/Code.gs` de ce dossier.
3. Roue dentée **Paramètres du projet** : fuseau horaire **(GMT+01:00) Paris**, et cocher « Afficher le fichier manifeste appsscript.json ». Revenir à l’éditeur, remplacer `appsscript.json` par celui de ce dossier. Enregistrer.
4. En haut, choisir la fonction **`installer`** → **Exécuter**. Google demande des autorisations (agenda, e-mails, Google Sheets, tâches automatiques) : **Examiner les autorisations** → compte d’Isabelle. Sur l’écran « Google n’a pas validé cette application » (normal pour un script personnel) : **Paramètres avancés** → **Accéder à Rendez-vous site** → **Autoriser**.
   Le journal affiche « Installation terminée » et l’adresse du tableau.

## 2. Mettre le script en ligne

1. **Déployer** → **Nouveau déploiement** → type **Application Web**.
2. Exécuter en tant que : **Moi**. Qui a accès : **Tout le monde**. **Déployer**.
3. Copier l’**URL de l’application Web** (elle finit par `/exec`).
4. Test : ouvrir cette adresse suivie de `?action=slots&commune=Brenoux`. On doit voir un texte qui commence par `{"ok":true,"days":[`.

## 3. Brancher le site

1. Dans `src/config.js`, coller l’URL entre les guillemets de `endpoint: ''`.
2. `npm run build`, puis publier (commit + push).
3. Faire une vraie demande de test avec ton e-mail : vérifier l’e-mail d’Isabelle, valider depuis le lien, vérifier l’e-mail de confirmation, puis supprimer l’événement de l’agenda.

## 4. Page « Mes rendez-vous » (cabinet-infirmier-rouffiac.fr/rdv)

Une page à elle, sur son site, qui s’utilise comme une appli sur le téléphone. Elle n’a pas besoin d’être connectée à Google, donc plus de souci de comptes multiples.

1. Dans l’éditeur du script : **Paramètres du projet** → **Propriétés du script** → ajouter `CODE_GESTION` avec le code choisi par Isabelle : des lettres (majuscules et minuscules comptent), des chiffres et des signes, **au moins 8 caractères** s’il y a des lettres, ou **au moins 6 chiffres** pour un code tout en chiffres (pas une date de naissance), et jamais 123456 : c’est le code de la démonstration, visible dans le code public du site. Ne jamais le mettre dans le code (le dépôt GitHub est public).
2. Coller la nouvelle version de `Code.gs`, puis **Déployer** → **Gérer les déploiements** → crayon → Version **Nouvelle version** → **Déployer**. L’URL ne change pas.
3. Sur le téléphone d’Isabelle, ouvrir `https://cabinet-infirmier-rouffiac.fr/rdv/`, taper le code. Le téléphone le retient.
4. Ajouter l’icône à l’écran d’accueil (sur iPhone, l’icône a sa propre mémoire : il faut retaper le code une fois en l’ouvrant) :
   - iPhone (Safari) : bouton **Partager** → **Sur l’écran d’accueil** ;
   - Android (Chrome) : menu **⋮** → **Ajouter à l’écran d’accueil**.

Sur la page, quatre onglets en bas de l’écran : **Demandes** (créneaux à confirmer, patients à rappeler, propositions en attente du patient), **Planning** (jour par jour : la journée de 7 h à 19 h, avec les rendez-vous du site en rouge et les autres événements de l’agenda en gris), **Historique** et **Réglages**. Toucher une ligne ouvre la fiche du patient : confirmer, proposer un autre horaire (les horaires libres sont affichés), refuser, et plus tard déplacer ou annuler. Boutons **Appeler**, **Itinéraire** et **E-mail** sur chaque fiche. Sur ordinateur, la liste et la fiche sont côte à côte.

Le réglage **« Confirmer automatiquement »** confirme tout de suite les créneaux choisis en ligne : le patient reçoit directement sa confirmation et Isabelle un e-mail « (confirmée automatiquement) ». Les demandes de rappel restent à traiter à la main.

Sécurité : toutes les 5 erreurs de code, la connexion est bloquée de plus en plus longtemps (15 min, 30 min, 1 h, 2 h, 4 h, puis 6 h) et Isabelle reçoit un e-mail « Mes rendez-vous : codes incorrects ». Le compteur repart à zéro à la première connexion réussie, et un téléphone déjà connecté continue de marcher pendant un blocage. **Changer `CODE_GESTION` déconnecte tous les téléphones** (à faire si un téléphone est perdu ou après une alerte suspecte).

En local (`npm run serve`, puis <http://localhost:4173/rdv/>), la page tourne en démonstration avec de faux patients, code `123456`. Ajouter `?live` à l’adresse pour utiliser le vrai script.

## Au quotidien, pour Isabelle

- **Tout se gère depuis la page « Mes rendez-vous ».** Le lien de l’e-mail ouvre directement la bonne demande. Le lien de secours (page Google) reste dans l’e-mail et dans la description de l’événement de l’agenda.
- **Bloquer un moment** (rendez-vous pris par téléphone, perso) : créer un événement dans l’agenda. Le site ne proposera pas de créneau qui le chevauche.
- **Congés** : un événement « journée entière » bloque la journée. Attention, un anniversaire noté en journée entière dans l’agenda principal bloque aussi la journée.
- **Annuler un rendez-vous** : bouton **Annuler** sur la page « Mes rendez-vous » (le patient est prévenu, le créneau est libéré). Supprimer l’événement de l’agenda ne prévient pas le patient.

## Réglages

En haut de `Code.gs`, bloc `CONFIG` (et les mêmes valeurs dans `src/config.js`) :

| Réglage | Valeur actuelle | Sens |
| --- | --- | --- |
| `calendarId` | agenda « boulot » | Agenda où le site crée les rendez-vous (ID trouvé dans Google Agenda : Paramètres et partage → Intégrer l’agenda) |
| `busyCalendars` | agenda principal (privé) | Agendas seulement lus : leurs événements avec une heure bloquent les créneaux, les « journée entière » sont ignorés. Rien n’y est écrit |
| `bookingTimes` | 7:00, 8:30, 9:00, 9:30, 10:00, 10:30, 17:00, 17:30 | Heures réservables en ligne par défaut. **Isabelle peut les changer elle-même** dans « Mes rendez-vous » → Réglages → Heures réservables en ligne (enregistré dans la propriété `BOOKING_TIMES` du script, qui prime sur cette valeur) |
| `firstStart`, `lastStart`, `step` | 07:00, 18:30, 30 | Journée d’Isabelle dans « Mes rendez-vous » (planning, autre horaire) : toutes les 30 min de 7 h à 18 h 30 |
| `duration` | 30 min | Durée d’un rendez-vous, trajet compris |
| `travel` | 0 / 0 / 0 min | Trajet ajouté entre deux rendez-vous (à 0 : compris dans les 30 min) |
| `SLOT_CARES` | 4 soins | Soins réservables en ligne (à garder identiques aux « data-slot » de `index.html`) |
| `weekdays` | lundi → vendredi | Jours des rendez-vous pris en ligne (aucun le week-end). Isabelle peut toujours fixer elle-même un rendez-vous le week-end depuis « Mes rendez-vous » |
| `bookingDays` | 7 jours sur 7 | Jours où l’on peut faire la réservation en ligne |
| `cutoffHour` | 18 | Demande possible jusqu’à la veille à 18 h |
| `reminderHour` | 17 | Heure d’envoi des rappels, la veille |

Après une modification de `Code.gs` : **Déployer** → **Gérer les déploiements** → crayon → Version **Nouvelle version** → **Déployer**. L’URL ne change pas. Si `reminderHour` change, relancer `installer`.

## Option SMS (payante)

Les SMS ne sont pas difficiles à envoyer, mais ils sont **payants** : environ 4 à 8 centimes par SMS selon le fournisseur. Pour environ 60 rendez-vous par mois, avec confirmation et rappel, ça fait 5 à 10 € par mois. Le script est prêt pour **Brevo** (fournisseur français) :

1. Créer un compte sur brevo.com au nom d’Isabelle, acheter un pack de SMS, puis créer une **clé API** (menu SMTP & API).
2. Dans l’éditeur du script : **Paramètres du projet** → **Propriétés du script** → ajouter `BREVO_API_KEY` avec la clé. Ne jamais la mettre dans le code (le dépôt GitHub est public).
3. Faire un test sur ton portable. À vérifier dans la documentation de Brevo au moment de l’activer : l’adresse de l’API SMS utilisée dans `sendSms_`.

Les SMS ne partent que vers les portables (06 et 07). Autre solution possible : l’API SMS d’OVH, puisqu’elle a déjà un compte OVH (à adapter dans `sendSms_`).

## Données personnelles

- Le tableau et les événements créés par le site sont **effacés automatiquement** 3 mois après le rendez-vous (tâche mensuelle `nettoyer`, créée par `installer`).
- Isabelle doit aussi supprimer de temps en temps les e-mails de demande dans sa messagerie.
- Le téléphone et l’ordinateur d’Isabelle doivent être protégés par un code : ils donnent accès à ces informations.

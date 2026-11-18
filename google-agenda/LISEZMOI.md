# Rendez-vous en ligne : installation et utilisation

Tant que ce n’est pas installé, le formulaire du site est en **mode démonstration** : on peut cliquer partout, mais rien n’est envoyé (un message l’indique).

## Ce que fait le système

1. Un patient fait une demande sur le site :
   - **prise de sang, pansement simple, retrait de points ou d’agrafes (moins de 10) ou vaccination (plus de 11 ans)**, dans l’une des 4 communes : il choisit un créneau libre de 30 minutes, n’importe quel jour entre 7 h et 19 h. La réservation elle-même n’est possible que du lundi au vendredi (fermée le samedi et le dimanche). Les créneaux déjà pris dans l’agenda ne sont pas proposés ;
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

## Au quotidien, pour Isabelle

- **Tout se gère depuis le lien de l’e-mail.** Le même lien est aussi dans la description de l’événement de l’agenda.
- **Bloquer un moment** (rendez-vous pris par téléphone, perso) : créer un événement dans l’agenda. Le site ne proposera pas de créneau qui le chevauche.
- **Congés** : un événement « journée entière » bloque la journée. Attention, un anniversaire noté en journée entière dans l’agenda principal bloque aussi la journée.
- **Annuler un rendez-vous** : supprimer l’événement de l’agenda et prévenir le patient.

## Réglages

En haut de `Code.gs`, bloc `CONFIG` (et les mêmes valeurs dans `src/config.js`) :

| Réglage | Valeur actuelle | Sens |
| --- | --- | --- |
| `firstStart`, `lastStart`, `step` | 07:00, 18:30, 30 | Créneaux proposés toutes les 30 min, de 7 h à 18 h 30 (fin à 19 h) |
| `duration` | 30 min | Durée d’un rendez-vous, trajet compris |
| `travel` | 0 / 0 / 0 min | Trajet ajouté entre deux rendez-vous (à 0 : compris dans les 30 min) |
| `SLOT_CARES` | 4 soins | Soins réservables en ligne (à garder identiques aux « data-slot » de `index.html`) |
| `weekdays` | 7 jours sur 7 | Jours où un rendez-vous peut avoir lieu |
| `bookingDays` | lundi → vendredi | Jours où l’on peut réserver en ligne (pas le samedi ni le dimanche) |
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

# Relier la réservation en ligne à Google Agenda

Tant que ce n’est pas fait, le site est en **mode démonstration** : on peut cliquer partout, mais aucune demande n’est envoyée (un message l’indique dans le formulaire).

Une fois relié :

- le site affiche les créneaux réellement libres dans l’agenda Google d’Isabelle ;
- chaque réservation de prise de sang s’inscrit dans son agenda, en rouge, avec l’adresse (on peut la toucher pour lancer le GPS) et le téléphone ;
- pour les autres soins (ou une autre commune), elle reçoit la demande par e-mail : soin, commune, date et moment souhaités, coordonnées. Elle rappelle la personne pour fixer l’heure ;
- elle reçoit aussi un e-mail à chaque réservation de prise de sang.

C’est gratuit. Il faut un compte Google (Gmail) **à Isabelle** : les rendez-vous doivent arriver dans *son* agenda.

## 1. Créer le script (10 minutes, avec Isabelle)

1. Sur un ordinateur, connecté au compte Google d’Isabelle, ouvrir <https://script.google.com> puis **Nouveau projet**.
2. Renommer le projet (en haut à gauche) : `Rendez-vous site`.
3. Effacer le contenu du fichier `Code.gs` et coller à la place tout le fichier `google-agenda/Code.gs` de ce dossier.
4. Roue dentée **Paramètres du projet** :
   - fuseau horaire : **(GMT+01:00) Paris** ;
   - cocher « Afficher le fichier manifeste appsscript.json », puis revenir à l’éditeur et remplacer le contenu de `appsscript.json` par celui de ce dossier.
5. Enregistrer (icône disquette).

## 2. Autoriser et tester

1. Dans la liste des fonctions en haut, choisir `tester`, puis **Exécuter**.
2. Google demande l’autorisation d’accéder à l’agenda et d’envoyer des e-mails : **Examiner les autorisations**, choisir le compte d’Isabelle.
   Un écran « Google n’a pas validé cette application » s’affiche : c’est normal pour un script personnel. Cliquer **Paramètres avancés**, puis **Accéder à Rendez-vous site**, puis **Autoriser**.
3. Le journal en bas affiche la liste des jours et des créneaux : ça marche.

## 3. Mettre le script en ligne

1. **Déployer** → **Nouveau déploiement**.
2. Type : **Application Web**.
3. Exécuter en tant que : **Moi** (le compte d’Isabelle). Qui a accès : **Tout le monde**.
4. **Déployer**, puis copier l’**URL de l’application Web** (elle se termine par `/exec`).
5. Vérifier : coller cette adresse suivie de `?action=slots` dans un navigateur. On doit voir un texte qui commence par `{"ok":true,"days":[...`.

## 4. Brancher le site

1. Ouvrir `src/config.js` et coller l’URL entre les guillemets de `endpoint: ''`.
2. Dans un terminal, à la racine du site : `npm run build`.
3. Publier le site (commit + push sur GitHub). Le message « Version de démonstration » disparaît tout seul.
4. Faire une vraie réservation de test, vérifier qu’elle apparaît dans l’agenda et que l’e-mail arrive, puis supprimer l’événement.

## Au quotidien, pour Isabelle

- **Bloquer un créneau** (un autre patient, un rendez-vous perso) : créer n’importe quel événement dans son agenda entre 8 h 30 et 10 h 15. Le créneau disparaît du site.
- **Congés, journée fermée** : créer un événement « Journée entière ». Toute la journée disparaît du site. Attention : tout événement « journée entière » bloque la journée (un anniversaire noté dans l’agenda principal aussi).
- **Annuler un rendez-vous** : supprimer l’événement de l’agenda. Le créneau redevient libre sur le site.
- Les rendez-vous pris par téléphone peuvent être notés dans le même agenda : ils bloquent aussi le site.

## Changer les réglages

Jours ouverts, heure limite de la veille, créneaux, durées : ils sont en haut de `Code.gs` (bloc `CONFIG`) **et** dans `src/config.js`. Les deux doivent rester identiques.

Après une modification de `Code.gs` dans l’éditeur Google : **Déployer** → **Gérer les déploiements** → crayon → Version : **Nouvelle version** → **Déployer**. L’URL ne change pas.

## Données personnelles

Les mentions légales du site annoncent que les réservations sont effacées trois mois après le rendez-vous. Pour que ce soit automatique :

1. Dans l’éditeur du script, icône réveil **Déclencheurs** → **Ajouter un déclencheur**.
2. Fonction : `nettoyer`. Source : **Déclencheur horaire**. Type : **Minuteur mensuel**.

Le script n’efface que les événements créés par le site. Isabelle doit aussi supprimer de temps en temps les e-mails de réservation et de demande dans sa messagerie.

# Nos courses

Une liste de courses partagée pour deux, qui se met à jour en direct sur les deux téléphones et marche même sans réseau au fond du magasin.

Adresse de l'appli : https://kaanordagda5-commits.github.io/liste-de-course/

## Comment c'est construit

| Morceau | Rôle | Coût |
|---|---|---|
| `index.html`, `app.js` | L'écran de l'appli et sa logique | — |
| GitHub Pages | Met ces fichiers en ligne à une adresse du type `https://<pseudo>.github.io/liste-de-course/` | Gratuit |
| Firebase Firestore (Google) | Garde la liste et la synchronise entre les téléphones | Gratuit (offre Spark) |
| Firebase Authentication | Connexion avec vos comptes Google | Gratuit |
| `firestore.rules` | Le verrou : seuls vos deux comptes peuvent lire ou modifier la liste | — |
| `manifest.webmanifest`, `sw.js`, `icons/` | Rendent l'appli installable avec son icône, et utilisable hors ligne | — |

## Créer le projet Firebase (environ 10 minutes)

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) avec ton compte Google, puis **Créer un projet**. Nom : `nos-courses`. Tu peux refuser Google Analytics.
2. **Base de données** : menu **Créer > Firestore Database > Créer une base de données**. Emplacement : `europe-west` (par exemple `eur3`). Choisis **mode production**.
3. **Connexion Google** : menu **Créer > Authentication > Commencer**, onglet **Mode de connexion**, active **Google**, choisis ton e-mail d'assistance, puis **Enregistrer**.
4. **Autoriser l'adresse du site** : toujours dans Authentication, onglet **Paramètres > Domaines autorisés > Ajouter un domaine**, et ajoute `<ton-pseudo-github>.github.io`.
5. **Récupérer les clés** : roue dentée **Paramètres du projet**, en bas **Vos applications**, clique sur l'icône **</>** (Web), nomme-la `courses`, sans cocher Hosting. Firebase affiche un bloc `const firebaseConfig = { ... }`. Copie-le et envoie-le à Claude.

Ces clés ne sont pas secrètes : elles identifient le projet, et c'est le fichier de règles qui protège vos données.

## Ce que Claude fait ensuite

1. Remplit `config.js` avec ces clés et vos deux adresses Gmail.
2. Met le code sur GitHub et active GitHub Pages.
3. Te donne les règles de `firestore.rules` à coller dans **Firestore Database > Règles > Publier**.

## Installer l'appli sur Android

Ouvre l'adresse du site dans Chrome, connecte-toi avec Google, puis menu **⋮ > Installer l'application** (ou **Ajouter à l'écran d'accueil**). L'icône du panier vert apparaît sur l'écran d'accueil.

## Mettre à jour l'appli sur le téléphone

Après une nouvelle version, ferme complètement l'appli puis rouvre-la (deux fois si besoin). Le numéro de version s'affiche en bas de la liste, à côté de l'adresse Gmail.

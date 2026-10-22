// Réglages de l'appli. C'est le seul fichier à remplir.

// 1. Les clés du projet Firebase (Console Firebase > Paramètres du projet > Vos applications > Configuration).
//    Ces clés ne sont pas secrètes : la sécurité vient des règles Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: "A_REMPLIR",
  authDomain: "A_REMPLIR.firebaseapp.com",
  projectId: "A_REMPLIR",
  storageBucket: "A_REMPLIR.appspot.com",
  messagingSenderId: "A_REMPLIR",
  appId: "A_REMPLIR",
};

// 2. Les comptes Google autorisés à utiliser la liste (les mêmes que dans firestore.rules).
export const allowedEmails = [
  "premier.compte@gmail.com",
  "second.compte@gmail.com",
];

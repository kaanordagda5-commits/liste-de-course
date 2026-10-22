// Réglages de l'appli. C'est le seul fichier à remplir.

// 1. Les clés du projet Firebase (Console Firebase > Paramètres du projet > Vos applications > Configuration).
//    Ces clés ne sont pas secrètes : la sécurité vient des règles Firestore (firestore.rules).
export const firebaseConfig = {
  apiKey: "AIzaSyAiNmTwO7Yo7ldi-d9EnLhnPEN6oqWQet4",
  authDomain: "nos-courses-61418.firebaseapp.com",
  projectId: "nos-courses-61418",
  storageBucket: "nos-courses-61418.firebasestorage.app",
  messagingSenderId: "121765642084",
  appId: "1:121765642084:web:a5d08805af5ac459f84471",
};

// 2. Les comptes Google autorisés à utiliser la liste (les mêmes que dans firestore.rules).
export const allowedEmails = [
  "kaanordagda5@gmail.com",
];

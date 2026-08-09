// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// 1. Crie um projeto em https://console.firebase.google.com
// 2. Ative: Authentication (E-mail/Senha), Firestore Database, Storage
// 3. Em "Configurações do projeto" > "Seus apps" > Web, copie o objeto
//    de configuração e cole abaixo, substituindo os valores de exemplo.
// 4. Veja o README.md deste projeto para as Regras de Segurança
//    do Firestore e do Storage que devem ser publicadas.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

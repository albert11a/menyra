// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAq5kzdGITDekgajC0uUBny63JjS1DIPEU",
  authDomain: "menyra-c0e68.firebaseapp.com",
  projectId: "menyra-c0e68",
  storageBucket: "menyra-c0e68.firebasestorage.app",
  messagingSenderId: "528471049588",
  appId: "1:528471049588:web:c507d87c0832562a855821",
  measurementId: "G-YLFKC8726B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

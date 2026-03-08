import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVMONaokAzhWiYwTayJQZfvXM7VQlnWO4",
  authDomain: "jooli-fd293.firebaseapp.com",
  projectId: "jooli-fd293",
  storageBucket: "jooli-fd293.firebasestorage.app",
  messagingSenderId: "638063563868",
  appId: "1:638063563868:web:d6fa3397b7891fdb234299"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export function initAuth(onLogin) {

  document.getElementById("loginBtn").onclick = () => {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, password)
      .catch(e => alert(e.message));

  };

  onAuthStateChanged(auth, (user) => {
    if (user) {
      onLogin(user);
    }
  });

}
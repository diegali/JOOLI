import { initEvents } from "./events.js";
import { initCalendar } from "./calendar.js";
import { auth } from "./auth.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const usuariosMap = {
  "laura@ejemplo.com": "Laura",
  "mariano@ejemplo.com": "Mariano",
  "sebastian@ejemplo.com": "Sebastián",
};

document.addEventListener("DOMContentLoaded", () => {
  // --- LÓGICA DE LOGIN ---
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("email").value;
      const pass = document.getElementById("password").value;
      try {
        await signInWithEmailAndPassword(auth, email, pass);
        // El onAuthStateChanged se encargará del resto
      } catch (error) {
        alert("Error al ingresar: " + error.message);
      }
    });
  }

  // --- LÓGICA DE LOGOUT (Cerrar Sesión) ---
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await signOut(auth);
        location.reload(); // Recargamos para limpiar todo
      } catch (error) {
        console.error("Error al salir:", error);
      }
    });
  }

  // --- BOTÓN ESTADÍSTICAS ---
  const statsBtn = document.getElementById("toggleStatsBtn");
  const statsContainer = document.getElementById("statsContainer");
  if (statsBtn && statsContainer) {
    statsBtn.addEventListener("click", () => {
      const isHidden = statsContainer.style.display === "none";
      statsContainer.style.display = isHidden ? "block" : "none";
      statsBtn.innerText = isHidden
        ? "Ocultar Estadísticas"
        : "Ver Estadísticas y Filtros";
    });
  }

  // --- FILTRO DE MES ---
  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    monthFilter.addEventListener("change", (e) => {
      window.dispatchEvent(
        new CustomEvent("filterChanged", { detail: e.target.value }),
      );
    });
  }

  // --- CONTROL DE ESTADO DE USUARIO ---
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");
    const userDisplay = document.getElementById("userDisplay"); // Opcional: para mostrar el nombre arriba

    if (user) {
      if (loginDiv) loginDiv.style.display = "none";
      if (appDiv) appDiv.style.display = "block";

      window.userName = usuariosMap[user.email] || user.email.split("@")[0];
      if (userDisplay) userDisplay.innerText = `Hola, ${window.userName}`;

      initEvents();
      initCalendar();
    } else {
      if (loginDiv) loginDiv.style.display = "block";
      if (appDiv) appDiv.style.display = "none";
    }
  });
});

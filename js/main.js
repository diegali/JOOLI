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

// Función global para manejar navegación, resaltado y visibilidad de elementos
window.showSection = function (sectionId) {
  const sections = ["calendar", "eventsList", "statsContainer"];
  const searchSection = document.getElementById("searchSection");
  const addEventContainer = document.getElementById("addEventContainer");

  // 1. Alternar visibilidad de las secciones principales
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";

    // Resaltado visual del botón activo
    const btn = document.getElementById(`btn-${id}`);
    if (btn) {
      if (id === sectionId) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    }
  });

  // 2. Lógica de elementos contextuales
  // El buscador solo aparece en la lista de eventos
  if (searchSection) {
    searchSection.style.display = sectionId === "eventsList" ? "block" : "none";
  }

  // El botón "Agregar Evento" solo aparece en el calendario
  if (addEventContainer) {
    addEventContainer.style.display =
      sectionId === "calendar" ? "block" : "none";
  }

  // 3. Refresco necesario para el renderizado del calendario al volver a él
  if (sectionId === "calendar") {
    window.dispatchEvent(new Event("resize"));
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // --- LÓGICA DE LOGIN ---
  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      alert("Error al ingresar: " + error.message);
    }
  });

  // --- LÓGICA DE LOGOUT ---
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      location.reload();
    } catch (error) {
      console.error("Error al salir:", error);
    }
  });

  // --- FILTRO DE MES (Para estadísticas) ---
  document.getElementById("monthFilter")?.addEventListener("change", (e) => {
    window.dispatchEvent(
      new CustomEvent("filterChanged", { detail: e.target.value }),
    );
  });

  // --- CONTROL DE ESTADO DE USUARIO ---
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");
    const userDisplay = document.getElementById("userDisplay");

    if (user) {
      if (loginDiv) loginDiv.style.display = "none";
      if (appDiv) appDiv.style.display = "block";

      window.userName = usuariosMap[user.email] || user.email.split("@")[0];
      if (userDisplay) userDisplay.innerText = `${window.userName}`;

      initEvents();
      initCalendar();

      // Estado inicial: calendario activo
      window.showSection("calendar");
    } else {
      if (loginDiv) loginDiv.style.display = "block";
      if (appDiv) appDiv.style.display = "none";
    }
  });
});

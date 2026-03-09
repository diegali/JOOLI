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

window.showSection = function (sectionId) {
  const sections = ["calendar", "eventsList", "statsContainer"];
  const searchSection = document.getElementById("searchSection");
  const addEventContainer = document.getElementById("addEventContainer");

  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";
    const btn = document.getElementById(`btn-${id}`);
    if (btn) btn.classList.toggle("active", id === sectionId);
  });

  if (searchSection) searchSection.style.display = sectionId === "eventsList" ? "block" : "none";
  if (addEventContainer) addEventContainer.style.display = sectionId === "calendar" ? "block" : "none";

  if (sectionId === "calendar") window.dispatchEvent(new Event("resize"));
};

document.addEventListener("DOMContentLoaded", () => {
  // --- LÓGICA DE NOTIFICACIONES (Panel) ---
  const notifWrapper = document.getElementById("notificationWrapper");
  const notifPanel = document.getElementById("notificationPanel");

  notifWrapper?.addEventListener("click", () => {
    const isVisible = notifPanel.style.display === "block";
    notifPanel.style.display = isVisible ? "none" : "block";
    
    // Si abrimos el panel, procesamos las notificaciones como leídas
    if (!isVisible) {
      marcarNotificacionesComoLeidas();
    }
  });

  // Función para ocultar panel al hacer clic fuera
  document.addEventListener("click", (e) => {
    if (!notifWrapper.contains(e.target) && !notifPanel.contains(e.target)) {
      notifPanel.style.display = "none";
    }
  });

  function marcarNotificacionesComoLeidas() {
    const countEl = document.getElementById("notifCount");
    // Aquí iría tu lógica de Firebase para actualizar el estado en BD
    // Por ahora, reseteamos la UI visualmente:
    countEl.style.display = "none";
    countEl.innerText = "0";
    console.log("Notificaciones marcadas como leídas en Firebase");
  }

  // --- LÓGICA DE LOGIN/LOGOUT ---
  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert("Error: " + e.message); }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
  });

  // --- ESTADO USUARIO ---
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");
    
    if (user) {
      loginDiv.style.display = "none";
      appDiv.style.display = "block";
      initEvents();
      initCalendar();
      window.showSection("calendar");
    } else {
      loginDiv.style.display = "block";
      appDiv.style.display = "none";
    }
  });
});
import { initEvents } from "./events.js";
import { initCalendar } from "./calendar.js";
import { auth } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  // --- 1. Botón Estadísticas ---
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

  // --- 2. Botón Nuevo Evento ---
  const showFormBtn = document.getElementById("showFormBtn");
  const eventForm = document.getElementById("eventFormContainer");
  if (showFormBtn && eventForm) {
    showFormBtn.addEventListener("click", () => {
      eventForm.style.display = "block";
      document.getElementById("formTitle").innerText = "Nuevo Evento";
      document.getElementById("addBtn").style.display = "inline-block";
      document.getElementById("updateBtn").style.display = "none";
      eventForm.scrollIntoView({ behavior: "smooth" });
    });
  }

  // --- 3. Filtro de Mes ---
  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    monthFilter.addEventListener("change", (e) => {
      // Disparamos un evento personalizado para que events.js lo escuche
      window.dispatchEvent(
        new CustomEvent("filterChanged", { detail: e.target.value }),
      );
    });
  }

  // --- 4. Autenticación ---
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");
    if (user) {
      loginDiv.style.display = "none";
      appDiv.style.display = "block";
      initEvents();
      initCalendar();
    } else {
      loginDiv.style.display = "block";
      appDiv.style.display = "none";
    }
  });
});

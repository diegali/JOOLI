import { db } from "./auth.js";
import { fillFormForEdit } from "./events.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let calendar;

export function initCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  if (calendar) {
    calendar.destroy();
  }

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "dayGridMonth",
    locale: "es",
    height: "auto",
    headerToolbar: {
      left: "prev,next",
      center: "title",
      right: "dayGridMonth",
    },
    // --- MEJORA: Abrir formulario al tocar un día vacío ---
    dateClick: function (info) {
      // Limpiamos el formulario para un nuevo evento
      const addBtn = document.getElementById("addBtn");
      const showFormBtn = document.getElementById("showFormBtn");

      if (showFormBtn) showFormBtn.click(); // Disparamos la lógica de reset y apertura

      // Ponemos automáticamente la fecha que tocaste
      const dateInput = document.getElementById("date");
      if (dateInput) dateInput.value = info.dateStr;
    },

    // --- MEJORA: Edición al tocar un evento ---
    eventClick: function (info) {
      // Usamos la función global de events.js que ya maneja el scroll y el título
      fillFormForEdit(info.event.extendedProps, info.event.id);
    },
  });

  calendar.render();
  loadCalendarEvents();

  setTimeout(() => {
    calendar.updateSize();
  }, 500);
}

export function refreshCalendar() {
  if (calendar) calendar.updateSize();
}

function loadCalendarEvents() {
  const q = query(collection(db, "events"), orderBy("date"));

  onSnapshot(q, (snap) => {
    if (!calendar) return;
    const events = [];

    snap.forEach((d) => {
      const e = d.data();
      // Mismo mapa de colores que en las tarjetas para consistencia visual
      const colors = {
        Presupuestado: "#f1c40f",
        "Seña pagada": "#e67e22",
        Confirmado: "#27ae60",
        Realizado: "#2980b9",
        Cancelado: "#c0392b",
      };

      events.push({
        id: d.id,
        title: e.client, // Título más corto para que quepa mejor en móvil
        start: e.date,
        backgroundColor: colors[e.status] || "#ccc",
        borderColor: colors[e.status] || "#ccc",
        extendedProps: e,
      });
    });

    calendar.removeAllEvents();
    calendar.addEventSource(events);
  });
}

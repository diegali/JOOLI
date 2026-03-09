import { db } from "./auth.js";
import { fillFormForEdit } from "./events.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let calendar;

// --- FUNCIÓN GLOBAL PARA EDITAR DESDE EL RESUMEN ---
window.editFromSummary = function (id) {
  // Buscamos la data del evento en el array global
  const eventData = window.allEventsData.find(ev => ev.id === id);
  if (eventData) {
    fillFormForEdit(eventData, id);
    // Ocultamos el resumen después de seleccionar para que no estorbe la edición
    const summaryEl = document.getElementById("daySummary");
    if (summaryEl) summaryEl.style.display = "none";

    // Scroll al formulario
    document.getElementById("eventFormContainer")?.scrollIntoView({ behavior: "smooth" });
  }
};

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
    buttonText: {
      today: "Hoy",
      month: "Mes",
      week: "Semana",
    },

    // --- LÓGICA DE CLIC EN DÍA ---
    dateClick: function (info) {
      const selectedDate = info.dateStr;
      const eventsToday = (window.allEventsData || []).filter(e => e.date === selectedDate);
      const summaryEl = document.getElementById("daySummary");

      if (summaryEl) {
        if (eventsToday.length > 0) {
          // Generamos el HTML con botones clicables para editar
          const listHtml = eventsToday.map(e =>
            `<div 
              onclick="window.editFromSummary('${e.id}')" 
              style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding: 10px; cursor: pointer; background: #fff; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);"
            >
              <div>
                <strong style="color: #111; font-size: 1.05em;">${e.client}</strong><br>
                <small style="color: #666; font-weight: 500;">${e.type}</small>
              </div>
              <div style="background: #fdf9ea; padding: 5px; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 1px solid #d4af37;">
                <span style="color: #d4af37; font-size: 1em;">✎</span>
              </div>
            </div>`
          ).join("");

          summaryEl.innerHTML = `
            <div style="background: #fffdf5; border: 2px solid #d4af37; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
              <h4 style="margin-top: 0; color: #333; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">
                📅 Eventos el ${selectedDate.split('-').reverse().join('/')}:
              </h4>
              ${listHtml}
              <p style="font-size: 0.75em; color: #999; margin: 10px 0 0 0; font-style: italic;">
                Toca un evento para editarlo o usa el formulario abajo para uno nuevo.
              </p>
            </div>
          `;
          summaryEl.style.display = "block";
        } else {
          summaryEl.style.display = "none";
        }
      }

      // Preparamos el formulario para un nuevo evento
      const showFormBtn = document.getElementById("showFormBtn");
      if (showFormBtn) showFormBtn.click();

      const dateInput = document.getElementById("date");
      if (dateInput) dateInput.value = selectedDate;

      // Hacemos scroll suave hasta el resumen/formulario
      document.getElementById("eventFormContainer")?.scrollIntoView({ behavior: "smooth" });
    },

    eventClick: function (info) {
      fillFormForEdit(info.event.extendedProps, info.event.id);
    },

    eventDisplay: 'block',
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
      const colors = {
        Presupuestado: "#f1c40f",
        "Seña pagada": "#e67e22",
        Confirmado: "#27ae60",
        Realizado: "#2980b9",
        Cancelado: "#c0392b",
      };

      events.push({
        id: d.id,
        title: e.client,
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
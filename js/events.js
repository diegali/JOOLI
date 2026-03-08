import { db } from "./auth.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;
window.allEventsData = [];
let unreadNotifications = [];

// --- LÓGICA DE NOTIFICACIONES ---
function updateNotificationUI() {
  const countEl = document.getElementById("notifCount");
  const panel = document.getElementById("notificationPanel");
  if (!countEl || !panel) return;

  if (unreadNotifications.length > 0) {
    countEl.innerText = unreadNotifications.length;
    countEl.style.display = "block";
  } else {
    countEl.style.display = "none";
    panel.style.display = "none";
  }

  const list = panel.querySelector("ul");
  list.innerHTML = unreadNotifications.map((n) => `<li>${n}</li>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("notificationPanel")) {
    const panel = document.createElement("div");
    panel.id = "notificationPanel";
    panel.innerHTML = "<strong>Novedades</strong><ul></ul>";
    document.body.appendChild(panel);
  }

  const bell = document.getElementById("notificationWrapper");
  const panel = document.getElementById("notificationPanel");

  if (bell) {
    bell.addEventListener("click", () => {
      panel.style.display = panel.style.display === "block" ? "none" : "block";
      if (panel.style.display === "none") {
        unreadNotifications = [];
        updateNotificationUI();
      }
    });
  }
});

export function resetForm() {
  editingId = null;
  const form = document.getElementById("eventFormContainer");
  if (form) {
    form.style.display = "none";
    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!["type", "status", "paid"].includes(el.id)) el.value = "";
    });
  }
  document.getElementById("formTitle").innerText = "Nuevo Evento";
  document.getElementById("updateBtn").style.display = "none";
  document.getElementById("addBtn").style.display = "inline-block";
}

export function initEvents() {
  document
    .getElementById("cancelFormBtn")
    ?.addEventListener("click", resetForm);
  document.getElementById("addBtn")?.addEventListener("click", saveEvent);
  document
    .getElementById("updateBtn")
    ?.addEventListener("click", updateExistingEvent);

  document.getElementById("showFormBtn")?.addEventListener("click", () => {
    resetForm();
    document.getElementById("eventFormContainer").style.display = "block";
  });

  document.getElementById("eventsList").addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      const id = card.dataset.id;
      const eventData = window.allEventsData.find((ev) => ev.id === id);
      if (eventData) fillFormForEdit(eventData, id);
    }
  });

  loadEvents();
  initSearch();
}

async function saveEvent() {
  const eventData = getFormData();
  eventData.ultimoCambioPor = window.userName;
  try {
    await addDoc(collection(db, "events"), eventData);
    resetForm();
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

async function updateExistingEvent() {
  if (!editingId) return;
  const eventData = getFormData();
  eventData.ultimoCambioPor = window.userName;
  try {
    await updateDoc(doc(db, "events", editingId), eventData);
    resetForm();
  } catch (error) {
    console.error("Error al actualizar:", error);
  }
}

function getFormData() {
  return {
    date: document.getElementById("date").value,
    type: document.getElementById("type").value,
    client: document.getElementById("client").value,
    cuit: document.getElementById("cuit").value,
    place: document.getElementById("place").value,
    guests: document.getElementById("guests").value,
    total: document.getElementById("total").value,
    deposit: document.getElementById("deposit").value,
    status: document.getElementById("status").value,
    paid: document.getElementById("paid").value === "true",
    invoiceNumber: document.getElementById("invoiceNumber").value,
    notes: document.getElementById("notes").value,
  };
}

function loadEvents() {
  const q = query(collection(db, "events"), orderBy("date"));
  onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (!snap.metadata.hasPendingWrites && change.type !== "removed") {
        const ev = change.doc.data();
        if (ev.ultimoCambioPor !== window.userName) {
          const autor = ev.ultimoCambioPor || "Alguien";
          // Formato solicitado:
          // Nuevo: "Nombre" creó el evento "Cliente" para el día "Fecha"
          // Editado: "Nombre" modificó el evento "Cliente" para el día "Fecha"
          const accion =
            change.type === "added" ? "creó el evento" : "modificó el evento";
          const mensaje = `${autor} ${accion} "${ev.client}" para el día ${ev.date}.`;

          unreadNotifications.push(mensaje);
          updateNotificationUI();
        }
      }
    });

    window.allEventsData = [];
    snap.forEach((d) => {
      window.allEventsData.push({ ...d.data(), id: d.id });
    });
    renderFilteredEvents(window.allEventsData);
  });
}

export function fillFormForEdit(e, id) {
  editingId = id;
  const fields = [
    "date",
    "type",
    "client",
    "cuit",
    "place",
    "guests",
    "total",
    "deposit",
    "status",
    "invoiceNumber",
    "notes",
  ];
  fields.forEach((f) => {
    if (document.getElementById(f))
      document.getElementById(f).value = e[f] || "";
  });
  if (document.getElementById("paid"))
    document.getElementById("paid").value = e.paid ? "true" : "false";

  document.getElementById("formTitle").innerText = "Editando Evento";
  document.getElementById("updateBtn").style.display = "inline-block";
  document.getElementById("addBtn").style.display = "none";
  document.getElementById("eventFormContainer").style.display = "block";
  document
    .getElementById("eventFormContainer")
    .scrollIntoView({ behavior: "smooth" });
}

function initSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll(".card").forEach((card) => {
      card.style.display = card.innerText.toLowerCase().includes(term)
        ? ""
        : "none";
    });
  });
}

function updateClientDatalist(events) {
  const datalist = document.getElementById("clientList");
  if (!datalist) return;
  const clients = [...new Set(events.map((e) => e.client))].sort();
  datalist.innerHTML = clients
    .map((name) => `<option value="${name}">`)
    .join("");
}

function updateStats(events) {
  const totalMes = events.reduce((sum, e) => sum + Number(e.total || 0), 0);
  const senasMes = events.reduce((sum, e) => sum + Number(e.deposit || 0), 0);
  const totalEl = document.getElementById("totalMes");
  const senasEl = document.getElementById("senasMes");
  const saldoEl = document.getElementById("saldoMes");
  const countEl = document.getElementById("eventosMes");
  if (totalEl) totalEl.innerText = `$${totalMes.toLocaleString()}`;
  if (senasEl) senasEl.innerText = `$${senasMes.toLocaleString()}`;
  if (saldoEl) saldoEl.innerText = `$${(totalMes - senasMes).toLocaleString()}`;
  if (countEl) countEl.innerText = events.length;
}

export function renderFilteredEvents(events) {
  const eventsList = document.getElementById("eventsList");
  if (!eventsList) return;
  eventsList.innerHTML = "";
  const today = new Date().toISOString().split("T")[0];
  const upcomingGroups = {};
  const pastGroups = {};
  events.forEach((e) => {
    const monthKey = getMonthLabel(e.date);
    const isPast = e.date < today;
    if (isPast) {
      if (!pastGroups[monthKey]) pastGroups[monthKey] = [];
      pastGroups[monthKey].push(createCard(e, e.id));
    } else {
      if (!upcomingGroups[monthKey]) upcomingGroups[monthKey] = [];
      upcomingGroups[monthKey].push(createCard(e, e.id));
    }
  });
  updateStats(events);
  updateClientDatalist(events);
  renderGroup(upcomingGroups, "📅 Próximos Eventos", "#27ae60");
  renderGroup(pastGroups, "📜 Historial", "#7f8c8d");
}

function renderGroup(groups, sectionTitle, color) {
  const eventsList = document.getElementById("eventsList");
  if (Object.keys(groups).length === 0) return;
  eventsList.innerHTML += `<h3 style="color:${color}; margin-top:30px;">${sectionTitle}</h3>`;
  for (const month in groups) {
    eventsList.innerHTML += `<h4 style="margin: 15px 0 5px 0; color: #d4af37;">${month}</h4>`;
    eventsList.innerHTML += groups[month].join("");
  }
}

function createCard(e, id) {
  const colors = {
    Presupuestado: "#f1c40f",
    "Seña pagada": "#e67e22",
    Confirmado: "#27ae60",
    Realizado: "#2980b9",
    Cancelado: "#c0392b",
  };
  const statusStyle = `background:${colors[e.status] || "#666"}; color:white; padding:4px 10px; border-radius:12px; font-size:0.75em; font-weight:bold; display:inline-block; min-width:80px; text-align:center;`;
  return `
    <div class="card" data-id="${id}" style="cursor:pointer; border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:10px; background:white;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex-grow: 1;">
          <small style="color:#555; font-weight:bold;">${formatDate(e.date)}</small><br>
          <strong style="font-size: 1.2em; color: #111;">${e.client}</strong><br>
          <small style="color:#d4af37; font-weight:bold;">${e.type}</small>
        </div>
        <span style="${statusStyle}">${e.status}</span>
      </div>
      <div style="margin-top:10px; font-size:0.9em; color:#333; border-top: 1px solid #eee; padding-top: 5px;">
        📍 ${e.place} | 👥 ${e.guests} pers. | 💰 $${Number(e.total).toLocaleString()}
      </div>
    </div>
  `;
}

function getMonthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const months = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR");
}

window.addEventListener("filterChanged", (e) => {
  const selectedMonth = e.detail;
  if (!selectedMonth) {
    renderFilteredEvents(window.allEventsData);
    return;
  }
  const filtered = window.allEventsData.filter((ev) =>
    ev.date.startsWith(selectedMonth),
  );
  renderFilteredEvents(filtered);
});

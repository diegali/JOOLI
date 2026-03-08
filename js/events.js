import { db } from "./auth.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;
let currentEventsData = {};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR");
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

export function initEvents() {
  const eventsList = document.getElementById("eventsList");

  // Delegación de eventos para las tarjetas
  eventsList.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (card) {
      const id = card.dataset.id;
      const eventData = currentEventsData[id];
      if (eventData) fillFormForEdit(eventData, id);
    }
  });

  loadEvents();
  initSearch(); // Aseguramos que el buscador se inicialice
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

function loadEvents() {
  const q = query(collection(db, "events"), orderBy("date"));
  onSnapshot(q, (snap) => {
    const eventsList = document.getElementById("eventsList");
    if (!eventsList) return;
    eventsList.innerHTML = "";
    currentEventsData = {};
    const allEvents = [];
    const today = new Date().toISOString().split("T")[0];
    const upcomingGroups = {};
    const pastGroups = {};

    snap.forEach((d) => {
      const e = d.data();
      currentEventsData[d.id] = e;
      allEvents.push(e);
      const monthKey = getMonthLabel(e.date);
      const isPast = e.date < today;

      if (isPast) {
        if (!pastGroups[monthKey]) pastGroups[monthKey] = [];
        pastGroups[monthKey].push(createCard(e, d.id));
      } else {
        if (!upcomingGroups[monthKey]) upcomingGroups[monthKey] = [];
        upcomingGroups[monthKey].push(createCard(e, d.id));
      }
    });

    renderGroup(upcomingGroups, "📅 Próximos Eventos", "#27ae60");
    renderGroup(pastGroups, "📜 Historial", "#7f8c8d");
    updateClientDatalist(allEvents);
  });
}

function renderGroup(groups, sectionTitle, color) {
  const eventsList = document.getElementById("eventsList");
  if (Object.keys(groups).length === 0) return;
  eventsList.innerHTML += `<h3 style="color:${color}; margin-top:30px;">${sectionTitle}</h3>`;
  for (const month in groups) {
    eventsList.innerHTML += `<h4 style="margin: 15px 0 5px 0; color: #d4af37;">${month}</h4>`;
    groups[month].forEach((card) => (eventsList.innerHTML += card));
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

  // JERARQUÍA CORREGIDA: Fecha arriba, Cliente resaltado, Tipo debajo
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

export function fillFormForEdit(e, id) {
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
  editingId = id;
  document.getElementById("formTitle").innerText = "Editando Evento";
  document.getElementById("updateBtn").style.display = "inline-block";
  document.getElementById("addBtn").style.display = "none";
  document.getElementById("eventFormContainer").style.display = "block";
  document
    .getElementById("eventFormContainer")
    .scrollIntoView({ behavior: "smooth" });
}

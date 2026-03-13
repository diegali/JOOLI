import { db, auth } from "./auth.js";
import { renderStaffSelection } from "./staff.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;
window.allEventsData = [];

// ===============================
// HELPERS
// ===============================
function getCurrentUserName() {
  const email = auth.currentUser?.email;

  const usuariosMap = {
    "almos2712@hotmail.com": "Laura",
    "mariano@a.com": "Mariano",
    "seba@a.com": "Sebastián",
  };

  return usuariosMap[email] || email || "Usuario";
}

function formatDateShort(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = String(d.getFullYear()).slice(-2);

  return `${dd}/${mm}/${aa}`;
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

// ===============================
// FORMULARIO
// ===============================
export function resetForm() {
  editingId = null;

  const form = document.getElementById("eventFormContainer");

  if (form) {
    form.style.display = "none";

    form.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!["type", "status", "paid", "invoiceType"].includes(el.id)) {
        el.value = "";
      }

      if (el.type === "checkbox") {
        el.checked = false;
      }
    });
  }

  const formTitle = document.getElementById("formTitle");
  const updateBtn = document.getElementById("updateBtn");
  const addBtn = document.getElementById("addBtn");

  if (formTitle) formTitle.innerText = "Nuevo Evento";
  if (updateBtn) updateBtn.style.display = "none";
  if (addBtn) addBtn.style.display = "inline-block";
}

function getFormData() {
  const selectedStaff = Array.from(
    document.querySelectorAll('input[name="staffSelected"]:checked')
  ).map((cb) => cb.value);

  return {
    invoiceType: document.getElementById("invoiceType")?.value || "B/C",
    date: document.getElementById("date")?.value || "",
    type: document.getElementById("type")?.value || "",
    client: document.getElementById("client")?.value || "",
    cuit: document.getElementById("cuit")?.value || "",
    place: document.getElementById("place")?.value || "",
    horaInicio: document.getElementById("horaInicio")?.value || "",
    horaFin: document.getElementById("horaFin")?.value || "",
    guests: document.getElementById("guests")?.value || "",
    staffNecesario:
      document.getElementById("staffNecesario")?.value ||
      Math.ceil((document.getElementById("guests")?.value || 0) / 15),
    total: document.getElementById("total")?.value || "",
    deposit: document.getElementById("deposit")?.value || "",
    status: document.getElementById("status")?.value || "",
    paid: document.getElementById("paid")?.value === "true",
    invoiceNumber: document.getElementById("invoiceNumber")?.value || "",
    notes: document.getElementById("notes")?.value || "",
    staffAsignado: selectedStaff,
  };
}

// ===============================
// CRUD EVENTOS
// ===============================
async function saveEvent() {
  const eventData = getFormData();
  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;

  eventData.ultimoCambioPor = userName;
  eventData.mensajesEnviados = [];

  try {
    await addDoc(collection(db, "events"), eventData);

    await addDoc(collection(db, "notificaciones"), {
      mensaje: `${userName} creó el evento "${eventData.client}" del ${formatDateShort(eventData.date)}`,
      leida: false,
      creadoPorEmail: userEmail,
      fecha: serverTimestamp(),
    });

    resetForm();
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

async function updateExistingEvent() {
  if (!editingId) return;

  const eventData = getFormData();
  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;

  eventData.ultimoCambioPor = userName;

  try {
    await updateDoc(doc(db, "events", editingId), eventData);

    await addDoc(collection(db, "notificaciones"), {
      mensaje: `${userName} modificó el evento "${eventData.client}" del ${formatDateShort(eventData.date)}`,
      leida: false,
      creadoPorEmail: userEmail,
      fecha: serverTimestamp(),
    });

    window.editingId = "";
    resetForm();
  } catch (error) {
    console.error("Error al actualizar:", error);
  }
}

function loadEvents() {
  const q = query(collection(db, "events"), orderBy("date"));

  onSnapshot(q, (snap) => {
    window.allEventsData = [];

    snap.forEach((d) => {
      window.allEventsData.push({ ...d.data(), id: d.id });
    });

    renderFilteredEvents(window.allEventsData);
  });
}

// ===============================
// EDITAR EVENTO
// ===============================
export async function fillFormForEdit(evento, id) {
  editingId = id;
  window.editingId = id;

  const fields = [
    "date",
    "type",
    "client",
    "cuit",
    "place",
    "horaInicio",
    "horaFin",
    "guests",
    "staffNecesario",
    "total",
    "deposit",
    "status",
    "invoiceNumber",
    "notes",
    "invoiceType",
  ];

  fields.forEach((field) => {
    const el = document.getElementById(field);
    if (el) {
      el.value = evento[field] || (field === "invoiceType" ? "B/C" : "");
    }
  });

  const paidEl = document.getElementById("paid");
  if (paidEl) {
    paidEl.value = evento.paid ? "true" : "false";
  }

  await renderStaffSelection();

  if (evento.staffAsignado) {
    evento.staffAsignado.forEach((idMozo) => {
      const checkbox = document.querySelector(`input[value="${idMozo}"]`);
      if (checkbox) checkbox.checked = true;
    });
  }

  const formTitle = document.getElementById("formTitle");
  const updateBtn = document.getElementById("updateBtn");
  const addBtn = document.getElementById("addBtn");
  const form = document.getElementById("eventFormContainer");

  if (formTitle) formTitle.innerText = "Editando Evento";
  if (updateBtn) updateBtn.style.display = "inline-block";
  if (addBtn) addBtn.style.display = "none";

  if (form) {
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth" });
  }
}

// ===============================
// BÚSQUEDA
// ===============================
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

// ===============================
// STATS Y DATALIST
// ===============================
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

// ===============================
// RENDER EVENTOS
// ===============================
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
  if (!eventsList) return;

  if (Object.keys(groups).length === 0) return;

  eventsList.innerHTML += `<h3 style="color:${color}; margin-top:30px;">${sectionTitle}</h3>`;

  for (const month in groups) {
    eventsList.innerHTML += `<h4 style="margin: 15px 0 5px 0; color: #d4af37;">${month}</h4>`;
    eventsList.innerHTML += groups[month].join("");
  }
}

function createCard(evento, id) {
  const colors = {
    Presupuestado: "#f1c40f",
    "Seña pagada": "#e67e22",
    Confirmado: "#27ae60",
    Realizado: "#2980b9",
    Cancelado: "#c0392b",
  };

  const statusStyle = `
    background:${colors[evento.status] || "#666"};
    color:white;
    padding:4px 10px;
    border-radius:12px;
    font-size:0.75em;
    font-weight:bold;
    display:inline-block;
    min-width:80px;
    text-align:center;
  `;

  const invoiceIndicator =
    evento.invoiceType === "A"
      ? `<span style="background:#34495e; color:white; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-left:5px;">FACT A</span>`
      : "";

  const staff = evento.mensajesEnviados || [];

  const confirmados = staff.filter(
    (m) => (typeof m === "object" ? m.estado : "pendiente") === "confirmado"
  ).length;

  const pendientes = staff.filter(
    (m) => (typeof m === "object" ? m.estado : "pendiente") === "pendiente"
  ).length;

  const rechazados = staff.filter(
    (m) => (typeof m === "object" ? m.estado : "pendiente") === "rechazado"
  ).length;

  const totalAsignados = confirmados + pendientes;
  let colorStaff = "#c0392b"; // rojo

  if (totalAsignados >= Number(evento.staffNecesario || 0) && totalAsignados > 0) {
    colorStaff = "#27ae60"; // verde
  } else if (totalAsignados > 0) {
    colorStaff = "#f39c12"; // amarillo
  }

  const staffNecesario = Number(evento.staffNecesario || 0);
  const faltanMozos = Math.max(staffNecesario - totalAsignados, 0);

  let textoStaff = `👥 Staff: ${totalAsignados} / ${evento.staffNecesario || "-"}`;

  if (staffNecesario > 0) {
    if (totalAsignados === 0) {
      textoStaff = `👥 Sin staff asignado`;
    } else if (faltanMozos === 0) {
      textoStaff = `👥 Staff completo ✔`;
    } else if (faltanMozos === 1) {
      textoStaff = `👥 Falta 1 mozo`;
    } else {
      textoStaff = `👥 Faltan ${faltanMozos} mozos`;
    }
  }


  return `
    <div class="card" data-id="${id}" style="cursor:pointer; border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:10px; background:white;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex-grow:1;">
          <small style="color:#555; font-weight:bold;">${formatDate(evento.date)}</small>${invoiceIndicator}<br>
          <strong style="font-size:1.2em; color:#111;">${evento.client}</strong><br>
          <small style="color:#d4af37; font-weight:bold;">${evento.type}</small>
        </div>
        <span style="${statusStyle}">${evento.status}</span>
      </div>

      <div style="margin-top:10px; font-size:0.9em; color:#333; border-top:1px solid #eee; padding-top:5px;">
        📍 ${evento.place} | 👥 ${evento.guests} pers. | 💰 $${Number(evento.total || 0).toLocaleString()}
        <br>
        🕒 Evento: ${evento.horaInicio || "-"} a ${evento.horaFin || "-"}
        <br>
        👔 Presentación: ${evento.horaPresentacion || "-"}
        <br>
        <span style="color:${colorStaff}; font-weight:bold;">
        ${textoStaff}
        </span> · ✔ ${confirmados} · ⏳ ${pendientes} · ❌ ${rechazados}
      </div>
    </div>
  `;
}

// ===============================
// INIT
// ===============================
export function initEvents() {
  document.getElementById("cancelFormBtn")?.addEventListener("click", resetForm);
  document.getElementById("addBtn")?.addEventListener("click", saveEvent);
  document.getElementById("updateBtn")?.addEventListener("click", updateExistingEvent);

  document.getElementById("showFormBtn")?.addEventListener("click", () => {
    resetForm();

    const form = document.getElementById("eventFormContainer");
    if (form) form.style.display = "block";
  });

  document.getElementById("btnGestionarStaff")?.addEventListener("click", () => {
    if (editingId) {
      window.abrirModalGestionStaff(editingId);
    } else {
      alert("Para gestionar el staff, primero guarda el evento o selecciónalo desde la lista.");
    }
  });

  document.getElementById("eventsList")?.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    const eventData = window.allEventsData.find((ev) => ev.id === id);

    if (eventData) {
      fillFormForEdit(eventData, id);
    }
  });

  const guestsInput = document.getElementById("guests");
  const staffInput = document.getElementById("staffNecesario");

  let staffEditadoManualmente = false;

  if (guestsInput && staffInput) {
    guestsInput.addEventListener("input", function () {
      const invitados = Number(this.value) || 0;

      if (!staffEditadoManualmente) {
        staffInput.value = invitados > 0 ? Math.ceil(invitados / 15) : "";
      }
    });

    staffInput.addEventListener("input", function () {
      if (this.value) {
        staffEditadoManualmente = true;
      } else {
        staffEditadoManualmente = false;
        const invitados = Number(guestsInput.value) || 0;
        staffInput.value = invitados > 0 ? Math.ceil(invitados / 15) : "";
      }
    });
  }

  loadEvents();
  initSearch();
}
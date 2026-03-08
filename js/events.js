import { db } from "./auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;

// Formateo de fecha para las tarjetas
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR");
}

export function initEvents() {
  const eventsList = document.getElementById("eventsList");
  const monthFilter = document.getElementById("monthFilter");
  const formContainer = document.getElementById("eventFormContainer");
  const showFormBtn = document.getElementById("showFormBtn");
  const cancelFormBtn = document.getElementById("cancelFormBtn");
  const addBtn = document.getElementById("addBtn");
  const updateBtn = document.getElementById("updateBtn");
  const toggleStatsBtn = document.getElementById("toggleStatsBtn");
  const statsContainer = document.getElementById("statsContainer");

  loadEvents();

  // --- Lógica de Interfaz ---
  if (toggleStatsBtn && statsContainer) {
    toggleStatsBtn.onclick = () => {
      const isHidden = statsContainer.style.display === "none";
      statsContainer.style.display = isHidden ? "block" : "none";
      toggleStatsBtn.innerText = isHidden
        ? "Ocultar Estadísticas"
        : "Ver Estadísticas y Filtros";
      toggleStatsBtn.style.background = isHidden ? "#c0392b" : "#3498db";

      // Si se abre y el filtro está vacío, ponemos el mes actual
      if (isHidden && !monthFilter.value) {
        const now = new Date();
        const yearMonth = now.toISOString().substring(0, 7); // Formato YYYY-MM
        monthFilter.value = yearMonth;
        loadEvents(); // Disparamos la carga para que se actualicen los números
      }
    };
  }

  if (showFormBtn) {
    showFormBtn.onclick = () => {
      resetForm();
      formContainer.style.display = "block";
      document.getElementById("formTitle").innerText = "Nuevo Evento";
      formContainer.scrollIntoView({ behavior: "smooth" });
    };
  }

  if (cancelFormBtn) {
    cancelFormBtn.onclick = () => resetForm();
  }

  if (addBtn) addBtn.onclick = () => saveEvent(false);
  if (updateBtn) updateBtn.onclick = () => saveEvent(true);
  if (monthFilter) monthFilter.addEventListener("change", loadEvents);

  // --- Funciones de Datos ---
  async function saveEvent(isUpdate = false) {
    const data = {
      date: document.getElementById("date").value,
      type: document.getElementById("type").value,
      client: document.getElementById("client").value,
      cuit: document.getElementById("cuit").value,
      place: document.getElementById("place").value,
      guests: Number(document.getElementById("guests").value) || 0,
      total: Number(document.getElementById("total").value) || 0,
      deposit: Number(document.getElementById("deposit").value) || 0,
      status: document.getElementById("status").value,
      paid: document.getElementById("paid").value === "true",
      invoiceNumber: document.getElementById("invoiceNumber").value,
      notes: document.getElementById("notes").value,
    };

    if (!data.date || !data.client) {
      alert("Por favor completa al menos Fecha y Cliente");
      return;
    }

    try {
      if (isUpdate && editingId) {
        await updateDoc(doc(db, "events", editingId), data);
        alert("✅ Evento actualizado");
      } else {
        await addDoc(collection(db, "events"), data);
        alert("✅ Evento guardado");
      }
      resetForm();
    } catch (e) {
      alert("Error: " + e.message);
    }
  }

  function loadEvents() {
    const q = query(collection(db, "events"), orderBy("date"));
    onSnapshot(q, (snap) => {
      if (!eventsList) return;
      eventsList.innerHTML = "";
      const allEvents = [];

      snap.forEach((d) => {
        const e = d.data();
        allEvents.push(e);

        const colors = {
          Presupuestado: "#f1c40f",
          "Seña pagada": "#e67e22",
          Confirmado: "#27ae60",
          Realizado: "#2980b9",
          Cancelado: "#c0392b",
        };

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between;">
            <div>
              <strong>${formatDate(e.date)}</strong> - ${e.type}<br>
              <small>${e.client} | ${e.place}</small>
            </div>
            <span class="status-badge" style="background:${colors[e.status] || "#666"}; color:white; padding:2px 8px; border-radius:10px; font-size:0.8em;">
              ${e.status}
            </span>
          </div>
          <button class="deleteBtn" style="margin-top:10px;">Eliminar</button>
        `;

        card.querySelector(".deleteBtn").onclick = (ev) => {
          ev.stopPropagation();
          if (confirm("¿Eliminar este evento?"))
            deleteDoc(doc(db, "events", d.id));
        };

        card.onclick = () => fillFormForEdit(e, d.id);
        eventsList.appendChild(card);
      });
      updateStats(allEvents);
    });
  }

  function updateStats(events) {
    const selectedMonth = monthFilter ? monthFilter.value : "";
    let total = 0,
      senas = 0,
      cantidad = 0;

    events.forEach((e) => {
      if (!selectedMonth || e.date.startsWith(selectedMonth)) {
        total += Number(e.total) || 0;
        senas += Number(e.deposit) || 0;
        cantidad++;
      }
    });

    if (document.getElementById("totalMes"))
      document.getElementById("totalMes").innerText =
        `$${total.toLocaleString()}`;
    if (document.getElementById("senasMes"))
      document.getElementById("senasMes").innerText =
        `$${senas.toLocaleString()}`;
    if (document.getElementById("saldoMes"))
      document.getElementById("saldoMes").innerText =
        `$${(total - senas).toLocaleString()}`;
    if (document.getElementById("eventosMes"))
      document.getElementById("eventosMes").innerText = cantidad;
  }
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

function resetForm() {
  editingId = null;
  const inputs = document.querySelectorAll(
    "#eventFormContainer input, #eventFormContainer textarea, #eventFormContainer select",
  );
  inputs.forEach((i) => {
    if (i.id === "status") i.value = "Presupuestado";
    else if (i.id === "paid") i.value = "false";
    else if (i.id === "type") i.value = "Catering Completo";
    else i.value = "";
  });
  document.getElementById("updateBtn").style.display = "none";
  document.getElementById("addBtn").style.display = "inline-block";
  document.getElementById("eventFormContainer").style.display = "none";
}

import {
  puedeEditarPresupuesto,
  actualizarUIBudget,
  subirPresupuestoEvento,
  eliminarPresupuestoEvento,
} from "./events/events-budget.js";
import {
  renderFilteredEvents,
  registerEventDetailModal,
} from "./events/events-render.js";
import { resetForm, getFormData } from "./events/events-form.js";
import {
  getCurrentUserName,
  formatDateShort,
  formatDate,
} from "./events/events-utils.js";
import { db, auth, storage } from "./auth.js";
import { renderStaffSelection } from "./staff.js";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;
window.allEventsData = [];

let eventoPendienteConfirmacion = null;
let modalConfirmacionAbierto = false;

function setEditingId(value) {
  editingId = value;
  window.editingId = value;
}

function resetEventForm() {
  resetForm({
    setEditingId,
    actualizarUIBudget: (evento) => actualizarUIBudget(evento, { auth }),
  });
}

function rerenderEvents() {
  renderFilteredEvents(window.allEventsData || [], {
    updateStats,
    updateClientDatalist,
  });

  const term = document.getElementById("searchInput")?.value.toLowerCase().trim();

  document.querySelectorAll(".event-card").forEach((card) => {
    card.style.display = !term || (card.dataset.cliente || "").includes(term) ? "" : "none";
  });

  setTimeout(() => {
    // Primero ocultar títulos de MES sin cards visibles
    document.querySelectorAll(".eventos-mes-titulo").forEach((titulo) => {
      let siguiente = titulo.nextElementSibling;
      let tieneVisibles = false;

      while (siguiente && !siguiente.classList.contains("eventos-mes-titulo") &&
        !siguiente.classList.contains("eventos-seccion-titulo")) {
        if (siguiente.classList.contains("event-card") && siguiente.style.display !== "none") {
          tieneVisibles = true;
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }

      titulo.style.display = tieneVisibles ? "" : "none";
    });

    // Después ocultar títulos de SECCIÓN que no tengan ningún mes visible
    document.querySelectorAll(".eventos-seccion-titulo").forEach((seccion) => {
      let siguiente = seccion.nextElementSibling;
      let tieneVisibles = false;

      while (siguiente && !siguiente.classList.contains("eventos-seccion-titulo")) {
        if (siguiente.classList.contains("eventos-mes-titulo") && siguiente.style.display !== "none") {
          tieneVisibles = true;
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }

      seccion.style.display = tieneVisibles ? "" : "none";
    });
  }, 0);
}

async function saveEvent() {
  const eventData = getFormData();

  if (!eventData.date || !eventData.client) {
    mostrarAvisoSimple(
      "Faltan datos",
      "Por favor completá al menos <strong>fecha</strong> y <strong>cliente</strong> antes de guardar.",
      "⚠️"
    );
    return;
  }
  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;
  if (!["Realizado", "Cancelado"].includes(eventData.status)) {
    eventData.realizacionConfirmada = false;
  }
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

    resetEventForm();
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

async function updateExistingEvent() {
  if (!editingId) return;

  const eventData = getFormData();

  if (!eventData.date || !eventData.client) {
    mostrarAvisoSimple(
      "Faltan datos",
      "Por favor completá al menos <strong>fecha</strong>, <strong>cliente</strong> y <strong>total</strong> antes de guardar.",
      "⚠️"
    );
    return;
  }
  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;
  delete eventData.presupuestoURL;
  delete eventData.presupuestoNombre;
  delete eventData.presupuestoPath;

  if (!["Realizado", "Cancelado"].includes(eventData.status)) {
    eventData.realizacionConfirmada = false;
  }

  eventData.ultimoCambioPor = userName;

  try {
    await updateDoc(doc(db, "events", editingId), eventData);

    await addDoc(collection(db, "notificaciones"), {
      mensaje: `${userName} modificó el evento "${eventData.client}" del ${formatDateShort(eventData.date)}`,
      leida: false,
      creadoPorEmail: userEmail,
      fecha: serverTimestamp(),
    });

    resetEventForm();
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

    verificarEventosPasados(window.allEventsData);
    if (!modalConfirmacionAbierto && !window._avisosMostrados) {
      window._avisosMostrados = true;
      verificarAvisosPendientes(window.allEventsData);
    }

    rerenderEvents();
  });
}

window.resetFormConfirmado = function () {
  document.getElementById("modalAvisoSimple").style.display = "none";
  resetEventForm();
};

// ===============================
// GOOGLE MAPS
// ===============================

window.abrirModalMaps = async function () {
  const modal = document.getElementById("modalMaps");
  if (!modal) return;
  modal.style.display = "flex";

  const { Map } = await google.maps.importLibrary("maps");
  const { AdvancedMarkerElement } = await google.maps.importLibrary("marker");
  const { PlaceAutocompleteElement, Place } = await google.maps.importLibrary("places");

  // Reiniciar siempre al abrir
  window._selectedPlace = null;
  document.getElementById("mapPlaceInfo").textContent = "";

  const map = new Map(document.getElementById("mapContainer"), {
    center: { lat: -31.4135, lng: -64.1811 },
    zoom: 13,
    mapId: "JOOLI_MAP",
  });
  window._mapInstance = map;

  const marker = new AdvancedMarkerElement({ map });

  // Reemplazar el contenedor del buscador
  const searchContainer = document.getElementById("mapsSearchContainer");
  searchContainer.innerHTML = "";

  const autocomplete = new PlaceAutocompleteElement({
    componentRestrictions: { country: "ar" },
  });
  autocomplete.style.width = "100%";
  autocomplete.style.marginBottom = "12px";
  searchContainer.appendChild(autocomplete);

  autocomplete.addEventListener("gmp-select", async (e) => {
    const place = new Place({ id: e.placePrediction.placeId });

    await place.fetchFields({
      fields: ["displayName", "formattedAddress", "location", "googleMapsURI"],
    });

    const location = place.location;
    map.setCenter(location);
    map.setZoom(16);
    marker.position = location;

    window._selectedPlace = {
      nombre: place.displayName,
      direccion: place.formattedAddress,
      url: place.googleMapsURI,
    };

    document.getElementById("mapPlaceInfo").textContent =
      `📍 ${place.displayName} — ${place.formattedAddress}`;
  });
};

window.cerrarModalMaps = function () {
  document.getElementById("modalMaps").style.display = "none";
};

window.confirmarUbicacion = function () {
  const place = window._selectedPlace;
  if (!place) {
    mostrarAvisoSimple("Sin selección", "Buscá y seleccioná un lugar primero.", "⚠️");
    return;
  }

  const placeInput = document.getElementById("place");
  if (placeInput) placeInput.value = place.nombre || place.direccion;

  let hidden = document.getElementById("placeUrl");
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "placeUrl";
    document.getElementById("eventFormContainer").appendChild(hidden);
  }
  hidden.value = place.url || "";

  window.cerrarModalMaps();
};

// ===============================
// BÚSQUEDA
// ===============================
function initSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();

    if (!term) {
      rerenderEvents();
      return;
    }

    document.querySelectorAll(".event-card").forEach((card) => {
      card.style.display = (card.dataset.cliente || "").includes(term)
        ? ""
        : "none";
    });

    // Ocultar títulos de sección y mes si no tienen cards visibles debajo
    document.querySelectorAll(".eventos-seccion-titulo, .eventos-mes-titulo").forEach((titulo) => {
      let siguiente = titulo.nextElementSibling;
      let tieneVisibles = false;

      while (siguiente && !siguiente.classList.contains("eventos-mes-titulo") &&
        !siguiente.classList.contains("eventos-seccion-titulo")) {
        if (siguiente.classList.contains("event-card") && siguiente.style.display !== "none") {
          tieneVisibles = true;
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }

      titulo.style.display = tieneVisibles ? "" : "none";
    });

    document.querySelectorAll(".eventos-seccion-titulo").forEach((seccion) => {
      let siguiente = seccion.nextElementSibling;
      let tieneVisibles = false;

      while (siguiente && !siguiente.classList.contains("eventos-seccion-titulo")) {
        if (siguiente.classList.contains("eventos-mes-titulo") && siguiente.style.display !== "none") {
          tieneVisibles = true;
          break;
        }
        siguiente = siguiente.nextElementSibling;
      }

      seccion.style.display = tieneVisibles ? "" : "none";
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
  const monthFilter = document.getElementById("monthFilter")?.value;

  let eventosFiltrados = window.allEventsData || [];

  if (monthFilter) {
    eventosFiltrados = window.allEventsData.filter(e => {
      return e.date && e.date.startsWith(monthFilter);
    });
  }
  actualizarGrafico(window.allEventsData || []);

  eventosFiltrados = eventosFiltrados.filter(e => e.status !== "Cancelado" && e.status !== "Cerrado");

  const totalMes = eventosFiltrados.reduce((sum, e) => sum + Number(e.total || 0), 0);
  const senasMes = eventosFiltrados.reduce((sum, e) => sum + Number(e.deposit || 0), 0);
  const cobrado = eventosFiltrados.filter(e => e.paid === true).reduce((sum, e) => sum + Number(e.total || 0), 0);
  const porCobrar = totalMes - cobrado;

  const totalEl = document.getElementById("totalMes");
  const senasEl = document.getElementById("senasMes");
  const saldoEl = document.getElementById("saldoMes");
  const countEl = document.getElementById("eventosMes");
  const cobradoEl = document.getElementById("cobradoMes");
  const porCobrarEl = document.getElementById("porCobrarMes");

  if (totalEl) totalEl.innerText = `$${totalMes.toLocaleString()}`;
  if (senasEl) senasEl.innerText = `$${senasMes.toLocaleString()}`;
  if (saldoEl) saldoEl.innerText = `$${(totalMes - senasMes).toLocaleString()}`;
  if (countEl) countEl.innerText = eventosFiltrados.length;
  if (cobradoEl) cobradoEl.innerText = `$${cobrado.toLocaleString()}`;
  if (porCobrarEl) porCobrarEl.innerText = `$${porCobrar.toLocaleString()}`;
}

function actualizarGrafico(events) {
  const canvas = document.getElementById("chartEventosMes");
  if (!canvas) return;

  // Agrupar eventos por mes ignorando cancelados
  const conteo = {};
  events
    .filter(e => e.status !== "Cancelado")
    .forEach(e => {
      if (!e.date) return;
      const mes = e.date.substring(0, 7); // "2026-03"
      conteo[mes] = (conteo[mes] || 0) + 1;
    });

  const mesesOrdenados = Object.keys(conteo).sort();
  const labels = mesesOrdenados.map(m => {
    const [anio, mes] = m.split("-");
    const nombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${nombres[parseInt(mes) - 1]} ${anio}`;
  });
  const datos = mesesOrdenados.map(m => conteo[m]);

  if (window._chartEventos) {
    window._chartEventos.destroy();
  }

  window._chartEventos = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Eventos",
        data: datos,
        backgroundColor: "#d4af37",
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

function abrirModalConfirmarRealizacion(evento) {
  const modal = document.getElementById("modalConfirmarRealizacion");
  const texto = document.getElementById("textoConfirmarRealizacion");

  if (!modal || !texto) return;

  eventoPendienteConfirmacion = evento;
  modalConfirmacionAbierto = true;

  texto.innerHTML = `
    El evento de <strong>${evento.client || "sin cliente"}</strong><br>
    del <strong>${formatDate(evento.date)}</strong> ya pasó.<br><br>
    ¿Se realizó este evento?
  `;

  modal.style.display = "flex";
}

function cerrarModalConfirmarRealizacion() {
  const modal = document.getElementById("modalConfirmarRealizacion");
  if (!modal) return;

  modal.style.display = "none";
  eventoPendienteConfirmacion = null;
  modalConfirmacionAbierto = false;

  verificarAvisosPendientes(window.allEventsData || []);
}

window.mostrarAvisoSimple = function (titulo, mensaje, icono = "⚠️", mostrarBotonEntendido = true) {
  const modal = document.getElementById("modalAvisoSimple");
  const tituloEl = document.getElementById("modalAvisoTitulo");
  const mensajeEl = document.getElementById("modalAvisoMensaje");
  const iconoEl = document.getElementById("modalAvisoIcono");
  const btnEntendido = document.getElementById("btnCerrarAvisoSimple");

  if (!modal || !tituloEl || !mensajeEl || !iconoEl) return;

  tituloEl.textContent = titulo;
  mensajeEl.innerHTML = mensaje;
  iconoEl.textContent = icono;

  if (btnEntendido) {
    btnEntendido.style.display = mostrarBotonEntendido ? "inline-block" : "none";
  }

  modal.style.display = "flex";
}
const mostrarAvisoSimple = window.mostrarAvisoSimple;

function cerrarAvisoSimple() {
  const modal = document.getElementById("modalAvisoSimple");
  if (!modal) return;
  modal.style.display = "none";
}
function verificarEventosPasados(events) {
  if (modalConfirmacionAbierto) return;

  const today = new Date().toISOString().split("T")[0];

  for (const evento of events) {
    const yaPaso = evento.date && evento.date < today;
    const yaConfirmado = evento.realizacionConfirmada === true;
    const yaRealizado = evento.status === "Realizado";
    const yaCancelado = evento.status === "Cancelado";

    if (yaPaso && !yaConfirmado && !yaRealizado && !yaCancelado) {
      abrirModalConfirmarRealizacion(evento);
      break;
    }
  }
}

function verificarAvisosPendientes(events) {
  const today = new Date().toISOString().split("T")[0];
  const en3dias = new Date();
  en3dias.setDate(en3dias.getDate() + 3);
  const limite = en3dias.toISOString().split("T")[0];

  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  const fechaManana = manana.toISOString().split("T")[0];

  // Staff incompleto en próximos 3 días
  const staffCriticos = events.filter(e => {
    if (e.date < today || e.date > limite) return false;
    if (e.status === "Cancelado") return false;
    const staffNecesario = Number(e.staffNecesario || 0);
    if (staffNecesario === 0) return false;
    const asignados = (e.mensajesEnviados || []).filter(
      m => (m.estado || "pendiente") !== "rechazado"
    ).length;
    return asignados < staffNecesario;
  });

  // Checklist pendiente para mañana
  const checklistCriticos = events.filter(e => {
    if (e.date !== fechaManana) return false;
    if (e.status === "Cancelado") return false;
    const checklist = e.checklist || [];
    return checklist.length === 0 || checklist.some(item => !item.preparado);
  });

  if (staffCriticos.length === 0 && checklistCriticos.length === 0) return;

  let mensaje = "";

  if (staffCriticos.length > 0) {
    mensaje += `<strong>👥 Staff incompleto:</strong><br>`;
    mensaje += staffCriticos.map(e => {
      const asignados = (e.mensajesEnviados || []).filter(
        m => (m.estado || "pendiente") !== "rechazado"
      ).length;
      const faltan = Number(e.staffNecesario) - asignados;
      const fecha = new Date(e.date + "T00:00:00").toLocaleDateString("es-AR");
      return `• ${fecha} · ${e.client} — faltan <strong>${faltan} mozo${faltan > 1 ? "s" : ""}</strong>`;
    }).join("<br>");
  }

  if (checklistCriticos.length > 0) {
    if (mensaje) mensaje += "<br><br>";
    mensaje += `<strong>📦 Checklist pendiente para mañana:</strong><br>`;
    mensaje += checklistCriticos.map(e => {
      const checklist = e.checklist || [];
      const fecha = new Date(e.date + "T00:00:00").toLocaleDateString("es-AR");
      if (checklist.length === 0) {
        return `• ${fecha} · ${e.client} — sin checklist armado`;
      }
      const pendientes = checklist.filter(item => !item.preparado).length;
      return `• ${fecha} · ${e.client} — <strong>${pendientes} ítem${pendientes > 1 ? "s" : ""} sin preparar</strong>`;
    }).join("<br>");
  }

  mostrarAvisoSimple("Recordatorios", mensaje, "🔔");
}

async function confirmarRealizacionEvento(statusFinal) {
  if (!eventoPendienteConfirmacion) return;

  try {
    const ref = doc(db, "events", eventoPendienteConfirmacion.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      mostrarAvisoSimple(
        "El evento ya no existe.",
        "⚠️"
      );
      cerrarModalConfirmarRealizacion();
      return;
    }

    const dataActual = snap.data();

    if (dataActual.realizacionConfirmada === true) {
      cerrarModalConfirmarRealizacion();

      mostrarAvisoSimple(
        "Evento ya confirmado",
        `Otro usuario ya confirmó este evento como <strong>${dataActual.status}</strong>.`,
        "ℹ️"
      );

      return;
    }

    await updateDoc(ref, {
      status: statusFinal,
      realizacionConfirmada: true,
    });

    cerrarModalConfirmarRealizacion();
  } catch (error) {
    console.error("Error al confirmar realización del evento:", error);
  }
}

async function eliminarEvento() {
  if (!editingId) return;

  const eventoActual = window.allEventsData.find(ev => ev.id === editingId);
  const nombreEvento = eventoActual?.client || "este evento";

  mostrarAvisoSimple(
    "¿Eliminar evento?",
    `¿Seguro que querés eliminar el evento de <strong>${nombreEvento}</strong>? Esta acción no se puede deshacer.<br><br>` +
    `<button onclick="window.confirmarEliminarEvento()" class="btn-aviso-confirmar">Sí, eliminar</button>
    <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "🗑",
    false
  );
}

window.confirmarEliminarPresupuesto = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";

  await eliminarPresupuestoEvento(editingId, { db, storage, auth });
};

window.confirmarEliminarEvento = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";

  try {
    await deleteDoc(doc(db, "events", editingId));
    resetEventForm();
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    mostrarAvisoSimple("Error", "No se pudo eliminar el evento. Intentá de nuevo.", "❌");
  }
};

// ===============================
// INIT
// ===============================
export function initEvents() {
  document.getElementById("deleteBtn")?.addEventListener("click", eliminarEvento);
  document.getElementById("cancelFormBtn")?.addEventListener("click", () => {
    const client = document.getElementById("client")?.value;
    const date = document.getElementById("date")?.value;

    if (client || date) {
      mostrarAvisoSimple(
        "¿Cancelar?",
        "Tenés datos cargados. ¿Seguro que querés cancelar?<br><br>" +
        `<button onclick="window.resetFormConfirmado()" class="btn-aviso-confirmar">Sí, cancelar</button>
        <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Volver</button>`,
        "⚠️",
        false
      );
    } else {
      resetEventForm();
    }
  });
  document.getElementById("addBtn")?.addEventListener("click", saveEvent);
  document.getElementById("updateBtn")?.addEventListener("click", updateExistingEvent);
  document.getElementById("btnUbicar")?.addEventListener("click", window.abrirModalMaps);
  document.getElementById("showFormBtn")?.addEventListener("click", () => {
    resetEventForm();

    const form = document.getElementById("eventFormContainer");
    if (form) {
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
    }
  });

  document.getElementById("btnGestionarStaff")?.addEventListener("click", () => {
    if (editingId) {
      window.abrirModalGestionStaff(editingId);
    } else {
      mostrarAvisoSimple("Para gestionar el staff, primero guarda el evento o selecciónalo desde la lista.", "⚠️");
    }
  });



  const btnCerrarAvisoSimple = document.getElementById("btnCerrarAvisoSimple");

  if (btnCerrarAvisoSimple) {
    btnCerrarAvisoSimple.addEventListener("click", cerrarAvisoSimple);
  }

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
  document.getElementById("btnGestionarChecklist")?.addEventListener("click", () => {
    if (editingId) {
      window.abrirModalChecklist(editingId);
    } else {
      mostrarAvisoSimple("Para gestionar la checklist, primero guarda el evento o selecciónalo desde la lista.", "⚠️");
    }
  });

  const btnEventoRealizado = document.getElementById("btnEventoRealizado");
  const btnEventoCancelado = document.getElementById("btnEventoCancelado");
  const btnCerrarConfirmacionEvento = document.getElementById("btnCerrarConfirmacionEvento");

  if (btnEventoRealizado) {
    btnEventoRealizado.addEventListener("click", async () => {
      await confirmarRealizacionEvento("Realizado");
    });
  }

  if (btnEventoCancelado) {
    btnEventoCancelado.addEventListener("click", async () => {
      await confirmarRealizacionEvento("Cancelado");
    });
  }

  if (btnCerrarConfirmacionEvento) {
    btnCerrarConfirmacionEvento.addEventListener("click", () => {
      cerrarModalConfirmarRealizacion();
    });
  }

  document.addEventListener("change", (e) => {
    if (e.target.id === "monthFilter") {
      updateStats(window.allEventsData || []);
    }
  });

  document.getElementById("filtrosEventos")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filtro-estado");
    if (!btn) return;

    document.querySelectorAll(".filtro-estado").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    rerenderEvents();
  });

  const presupuestoFile = document.getElementById("presupuestoFile");
  const btnSubirPresupuesto = document.getElementById("btnSubirPresupuesto");
  const btnVerPresupuesto = document.getElementById("btnVerPresupuesto");
  const btnEliminarPresupuesto = document.getElementById("btnEliminarPresupuesto");

  if (btnSubirPresupuesto && presupuestoFile) {
    btnSubirPresupuesto.addEventListener("click", () => {
      if (!editingId) {
        mostrarAvisoSimple("Evento no guardado", "Primero guardá el evento para poder adjuntar el presupuesto.", "⚠️");
        return;
      }
      const evento = window.allEventsData.find(ev => ev.id === editingId);
      const eventoPasado = evento?.date < new Date().toISOString().split("T")[0];
      if (eventoPasado) return;
      presupuestoFile.click();
    });

    presupuestoFile.addEventListener("change", async () => {
      await subirPresupuestoEvento(editingId, { storage, db, auth });
      presupuestoFile.value = "";
    });
  }

  if (btnVerPresupuesto) {
    btnVerPresupuesto.onclick = () => {
      const eventoActual = window.allEventsData.find((ev) => ev.id === editingId);
      if (eventoActual?.presupuestoURL) {
        window.open(eventoActual.presupuestoURL, "_blank");
      }
    };
  }

  if (btnEliminarPresupuesto) {
    btnEliminarPresupuesto.addEventListener("click", () => {
      const eventoActual = window.allEventsData.find((ev) => ev.id === editingId);
      const nombreArchivo = eventoActual?.presupuestoNombre || "este archivo";

      mostrarAvisoSimple(
        "¿Eliminar presupuesto?",
        `¿Seguro que querés eliminar <strong>${nombreArchivo}</strong>?<br><br>` +
        `<button onclick="window.confirmarEliminarPresupuesto()" class="btn-aviso-confirmar">Sí, eliminar</button>
        <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
        "🗑️",
        false
      );
    });
  }

  registerEventDetailModal({
    getAllEvents: () => window.allEventsData || [],
    setEditingId,
    renderStaffSelection,
    puedeEditarPresupuesto: () => puedeEditarPresupuesto(auth),
  });
  loadEvents();
  initSearch();
}
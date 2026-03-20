import {
  puedeEditarPresupuesto,
  actualizarUIBudget,
  subirPresupuestoEvento,
  eliminarPresupuestoEvento,
  subirFacturaEvento,
  eliminarFacturaEvento,
} from "./events/events-budget.js";
import {
  renderFilteredEvents,
  registerEventDetailModal,
} from "./events/events-render.js";
import { resetForm, getFormData } from "./events/events-form.js";
import {
  getCurrentUserName,
  formatDateShort,
} from "./events/events-utils.js";
import { initJornadas } from "./events/events-jornadas.js";
import { initMaps } from "./events/events-maps.js";
import { initAvisos } from "./events/events-avisos.js";
import { db, auth, storage } from "./auth.js";
import { renderStaffSelection } from "./staff.js";
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let editingId = null;
window.allEventsData = [];

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

// ===============================
// RENDER
// ===============================
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
    document.querySelectorAll(".eventos-mes-titulo").forEach((titulo) => {
      let siguiente = titulo.nextElementSibling;
      let tieneVisibles = false;

      while (siguiente &&
        !siguiente.classList.contains("eventos-mes-titulo") &&
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
  }, 0);
}

// ===============================
// CRUD
// ===============================
function prepararEventData(eventData) {
  if (eventData.jornadas) {
    eventData.jornadas = eventData.jornadas.map(j => ({
      ...j,
      alquileres: j.alquileres && Object.keys(j.alquileres).length > 0
        ? j.alquileres
        : { vajilla: false, manteleria: false, mobiliario: false, mobiliarioTrabajo: false, notas: "" },
    }));
  }
  if (eventData.esMultidia && eventData.jornadas?.length > 0) {
    eventData.date = eventData.jornadas[0].fecha || "";
  }
  return eventData;
}

function validarEventData(eventData) {
  if (!eventData.client) {
    mostrarAvisoSimple("Faltan datos", "Por favor completá al menos <strong>cliente</strong> antes de guardar.", "⚠️");
    return false;
  }
  if (!eventData.esMultidia && !eventData.date) {
    mostrarAvisoSimple("Faltan datos", "Por favor completá al menos <strong>fecha</strong> y <strong>cliente</strong> antes de guardar.", "⚠️");
    return false;
  }
  if (eventData.esMultidia) {
    if (!eventData.jornadas || eventData.jornadas.length === 0) {
      mostrarAvisoSimple("Faltan jornadas", "Agregá al menos una jornada al evento.", "⚠️");
      return false;
    }
    const jornadaSinFecha = eventData.jornadas.findIndex(j => !j.fecha);
    if (jornadaSinFecha !== -1) {
      mostrarAvisoSimple("Fecha faltante", `La jornada ${jornadaSinFecha + 1} no tiene fecha asignada.`, "⚠️");
      return false;
    }
  }
  return true;
}

async function saveEvent() {
  const eventData = getFormData();
  if (!validarEventData(eventData)) return;

  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;

  if (!["Realizado", "Cancelado"].includes(eventData.status)) {
    eventData.realizacionConfirmada = false;
  }
  eventData.ultimoCambioPor = userName;
  eventData.mensajesEnviados = [];

  prepararEventData(eventData);

  try {
    await addDoc(collection(db, "events"), eventData);
    await addDoc(collection(db, "notificaciones"), {
      mensaje: `${userName} creó el evento "${eventData.client}"${eventData.date ? ` del ${formatDateShort(eventData.date)}` : ""}`,
      leida: false,
      creadoPorEmail: userEmail,
      fecha: serverTimestamp(),
    });
    resetEventForm();
  } catch (error) {
    console.error("Error al guardar:", error);
    mostrarAvisoSimple("Error", `No se pudo guardar: ${error.message}`, "❌");
  }
}

async function updateExistingEvent() {
  if (!editingId) return;

  const eventData = getFormData();
  if (!validarEventData(eventData)) return;

  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;

  delete eventData.presupuestoURL;
  delete eventData.presupuestoNombre;
  delete eventData.presupuestoPath;

  if (!["Realizado", "Cancelado"].includes(eventData.status)) {
    eventData.realizacionConfirmada = false;
  }
  eventData.ultimoCambioPor = userName;

  prepararEventData(eventData);

  try {
    await updateDoc(doc(db, "events", editingId), eventData);
    await addDoc(collection(db, "notificaciones"), {
      mensaje: `${userName} modificó el evento "${eventData.client}"${eventData.date ? ` del ${formatDateShort(eventData.date)}` : ""}`,
      leida: false,
      creadoPorEmail: userEmail,
      fecha: serverTimestamp(),
    });
    resetEventForm();
  } catch (error) {
    console.error("Error al actualizar:", error);
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
    "🗑", false
  );
}

window.confirmarEliminarEvento = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";
  const idAEliminar = window._eventoAEliminar || editingId;
  try {
    await deleteDoc(doc(db, "events", idAEliminar));
    window._eventoAEliminar = null;
    resetEventForm();
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    mostrarAvisoSimple("Error", "No se pudo eliminar el evento. Intentá de nuevo.", "❌");
  }
};

window.confirmarEliminarPresupuesto = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";
  await eliminarPresupuestoEvento(editingId, { db, storage, auth });
};

// ===============================
// LOAD
// ===============================
function loadEvents(avisos) {
  const q = query(collection(db, "events"));

  onSnapshot(q, (snap) => {
    window.allEventsData = [];
    snap.forEach((d) => {
      window.allEventsData.push({ ...d.data(), id: d.id });
    });

    window.allEventsData.sort((a, b) => {
      const fechaA = a.esMultidia ? (a.jornadas?.[0]?.fecha || "") : (a.date || "");
      const fechaB = b.esMultidia ? (b.jornadas?.[0]?.fecha || "") : (b.date || "");
      return fechaA.localeCompare(fechaB);
    });

    avisos.verificarEventosPasados(window.allEventsData);

    if (!avisos.isModalConfirmacionAbierto() && !window._avisosMostrados) {
      window._avisosMostrados = true;
      avisos.verificarAvisosPendientes(window.allEventsData);
    }

    rerenderEvents();
  });
}

// ===============================
// BÚSQUEDA
// ===============================
function initSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();

    if (!term) { rerenderEvents(); return; }

    document.querySelectorAll(".event-card").forEach((card) => {
      card.style.display = (card.dataset.cliente || "").includes(term) ? "" : "none";
    });

    document.querySelectorAll(".eventos-seccion-titulo, .eventos-mes-titulo").forEach((titulo) => {
      let siguiente = titulo.nextElementSibling;
      let tieneVisibles = false;
      while (siguiente &&
        !siguiente.classList.contains("eventos-mes-titulo") &&
        !siguiente.classList.contains("eventos-seccion-titulo")) {
        if (siguiente.classList.contains("event-card") && siguiente.style.display !== "none") {
          tieneVisibles = true; break;
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
          tieneVisibles = true; break;
        }
        siguiente = siguiente.nextElementSibling;
      }
      seccion.style.display = tieneVisibles ? "" : "none";
    });
  });
}

// ===============================
// STATS
// ===============================
function updateClientDatalist(events) {
  const datalist = document.getElementById("clientList");
  if (!datalist) return;
  const clients = [...new Set(events.map((e) => e.client))].sort();
  datalist.innerHTML = clients.map((name) => `<option value="${name}">`).join("");
}

function updateStats(events) {
  const monthFilter = document.getElementById("monthFilter")?.value;

  let eventosFiltrados = window.allEventsData || [];
  if (monthFilter) {
    eventosFiltrados = eventosFiltrados.filter(e => e.date && e.date.startsWith(monthFilter));
  }

  window._aviosInstance?.actualizarGrafico(window.allEventsData || []);

  eventosFiltrados = eventosFiltrados.filter(e => e.status !== "Cancelado" && e.status !== "Cerrado");

  const totalMes = eventosFiltrados.reduce((sum, e) => sum + Number(e.total || 0), 0);
  const senasMes = eventosFiltrados.reduce((sum, e) => sum + Number(e.deposit || 0), 0);
  const cobrado = eventosFiltrados.filter(e => e.paid === true).reduce((sum, e) => sum + Number(e.total || 0), 0);
  const porCobrar = totalMes - cobrado;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  set("totalMes", `$${totalMes.toLocaleString()}`);
  set("senasMes", `$${senasMes.toLocaleString()}`);
  set("saldoMes", `$${(totalMes - senasMes).toLocaleString()}`);
  set("eventosMes", eventosFiltrados.length);
  set("cobradoMes", `$${cobrado.toLocaleString()}`);
  set("porCobrarMes", `$${porCobrar.toLocaleString()}`);
}

// ===============================
// AVISO MODAL
// ===============================
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
  if (btnEntendido) btnEntendido.style.display = mostrarBotonEntendido ? "inline-block" : "none";
  modal.style.display = "flex";
};
const mostrarAvisoSimple = window.mostrarAvisoSimple;

function cerrarAvisoSimple() {
  const modal = document.getElementById("modalAvisoSimple");
  if (modal) modal.style.display = "none";
}

window.resetFormConfirmado = function () {
  document.getElementById("modalAvisoSimple").style.display = "none";
  resetEventForm();
};

// ===============================
// INIT
// ===============================
export function initEvents() {

  // Inicializar módulos
  initJornadas({ mostrarAvisoSimple });
  initMaps({ mostrarAvisoSimple });

  const avisos = initAvisos({
    mostrarAvisoSimple,
    onConfirmarRealizacion: async (evento, statusFinal) => {
      try {
        const ref = doc(db, "events", evento.id);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;

        const dataActual = snap.data();
        if (dataActual.realizacionConfirmada === true) {
          mostrarAvisoSimple(
            "Evento ya confirmado",
            `Otro usuario ya confirmó este evento como <strong>${dataActual.status}</strong>.`,
            "ℹ️"
          );
          return;
        }
        await updateDoc(ref, { status: statusFinal, realizacionConfirmada: true });
      } catch (error) {
        console.error("Error al confirmar realización:", error);
      }
    },
  });
  window._aviosInstance = avisos;

  // Botones del formulario
  document.getElementById("addBtn")?.addEventListener("click", saveEvent);
  document.getElementById("updateBtn")?.addEventListener("click", updateExistingEvent);
  document.getElementById("deleteBtn")?.addEventListener("click", eliminarEvento);
  document.getElementById("btnUbicar")?.addEventListener("click", window.abrirModalMaps);
  document.getElementById("btnCerrarAvisoSimple")?.addEventListener("click", cerrarAvisoSimple);

  document.getElementById("cancelFormBtn")?.addEventListener("click", () => {
    const client = document.getElementById("client")?.value;
    const date = document.getElementById("date")?.value;
    if (client || date) {
      mostrarAvisoSimple(
        "¿Cancelar?",
        "Tenés datos cargados. ¿Seguro que querés cancelar?<br><br>" +
        `<button onclick="window.resetFormConfirmado()" class="btn-aviso-confirmar">Sí, cancelar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Volver</button>`,
        "⚠️", false
      );
    } else {
      resetEventForm();
    }
  });

  document.getElementById("showFormBtn")?.addEventListener("click", () => {
    resetEventForm();
    const form = document.getElementById("eventFormContainer");
    if (form) { form.style.display = "block"; form.scrollIntoView({ behavior: "smooth" }); }
  });

  document.getElementById("btnGestionarStaff")?.addEventListener("click", () => {
    editingId
      ? window.abrirModalGestionStaff(editingId)
      : mostrarAvisoSimple("Para gestionar el staff, primero guarda el evento.", "⚠️");
  });

  document.getElementById("btnGestionarChecklist")?.addEventListener("click", () => {
    editingId
      ? window.abrirModalChecklist(editingId)
      : mostrarAvisoSimple("Para gestionar la checklist, primero guarda el evento.", "⚠️");
  });

  // Cálculo automático de mozos
  const guestsInput = document.getElementById("guests");
  const staffInput = document.getElementById("staffNecesario");
  let staffEditadoManualmente = false;

  if (guestsInput && staffInput) {
    guestsInput.addEventListener("input", function () {
      const invitados = Number(this.value) || 0;
      if (!staffEditadoManualmente) {
        staffInput.value = invitados > 0 ? Math.ceil(invitados / 10) : "";
      }
    });
    staffInput.addEventListener("input", function () {
      staffEditadoManualmente = !!this.value;
      if (!staffEditadoManualmente) {
        const invitados = Number(guestsInput.value) || 0;
        staffInput.value = invitados > 0 ? Math.ceil(invitados / 10) : "";
      }
    });
  }

  // Filtros
  document.addEventListener("change", (e) => {
    if (e.target.id === "monthFilter") updateStats(window.allEventsData || []);
  });

  document.getElementById("filtrosEventos")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filtro-estado");
    if (!btn) return;
    document.querySelectorAll(".filtro-estado").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    rerenderEvents();
  });

  // Presupuesto
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
      presupuestoFile.click();
    });
    presupuestoFile.addEventListener("change", async () => {
      await subirPresupuestoEvento(editingId, { storage, db, auth });
      presupuestoFile.value = "";
    });
  }

  if (btnVerPresupuesto) {
    btnVerPresupuesto.onclick = () => {
      const ev = window.allEventsData.find(ev => ev.id === editingId);
      if (ev?.presupuestoURL) window.open(ev.presupuestoURL, "_blank");
    };
  }

  if (btnEliminarPresupuesto) {
    btnEliminarPresupuesto.addEventListener("click", () => {
      const ev = window.allEventsData.find(ev => ev.id === editingId);
      const nombreArchivo = ev?.presupuestoNombre || "este archivo";
      mostrarAvisoSimple(
        "¿Eliminar presupuesto?",
        `¿Seguro que querés eliminar <strong>${nombreArchivo}</strong>?<br><br>` +
        `<button onclick="window.confirmarEliminarPresupuesto()" class="btn-aviso-confirmar">Sí, eliminar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
        "🗑️", false
      );
    });
  }

  // Factura
  const facturaFile = document.getElementById("facturaFile");
  const btnSubirFactura = document.getElementById("btnSubirFactura");
  const btnEliminarFactura = document.getElementById("btnEliminarFactura");

  if (btnSubirFactura && facturaFile) {
    btnSubirFactura.addEventListener("click", () => {
      if (!editingId) {
        mostrarAvisoSimple("Evento no guardado", "Primero guardá el evento para poder adjuntar la factura.", "⚠️");
        return;
      }
      facturaFile.click();
    });
    facturaFile.addEventListener("change", async () => {
      await subirFacturaEvento(editingId, { storage, db, auth });
      facturaFile.value = "";
    });
  }

  if (btnEliminarFactura) {
    btnEliminarFactura.addEventListener("click", () => {
      const ev = window.allEventsData.find(ev => ev.id === editingId);
      const nombreArchivo = ev?.facturaNombre || "esta factura";
      mostrarAvisoSimple(
        "¿Eliminar factura?",
        `¿Seguro que querés eliminar <strong>${nombreArchivo}</strong>?<br><br>` +
        `<button onclick="window.confirmarEliminarFactura()" class="btn-aviso-confirmar">Sí, eliminar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
        "🗑️", false
      );
    });
  }

  window.confirmarEliminarFactura = async function () {
    document.getElementById("modalAvisoSimple").style.display = "none";
    await eliminarFacturaEvento(editingId, { db, storage, auth });
  };

  // Staff/Checklist de jornadas
  window.abrirStaffJornada = function (jornadaIndex) {
    if (!window.editingId) {
      mostrarAvisoSimple("Guardá primero", "Guardá el evento antes de gestionar el staff de cada jornada.", "⚠️");
      return;
    }
    const evento = window.allEventsData.find(e => e.id === window.editingId);
    if (!evento) return;

    evento.jornadas = window._jornadasActuales ? [...window._jornadasActuales] : [];
    const jornada = evento.jornadas[jornadaIndex];
    if (!jornada) return;
    if (!jornada.mensajesEnviados) jornada.mensajesEnviados = [];

    const modal = document.getElementById("modalGestionStaff");
    const titulo = document.getElementById("tituloModalStaff");
    const resumen = document.getElementById("resumenStaffEvento");
    if (!modal || !titulo) return;

    const fecha = jornada.fecha
      ? new Date(jornada.fecha + "T00:00:00").toLocaleDateString("es-AR")
      : `Jornada ${jornadaIndex + 1}`;

    titulo.innerText = `👥 Staff · ${fecha}`;
    if (resumen) resumen.innerHTML = "";
    modal.dataset.eventId = window.editingId;
    modal.dataset.jornadaIdx = jornadaIndex;
    window._modoStaffJornada = true;
    window.abrirModalGestionStaff(window.editingId);
  };

  window.abrirChecklistJornada = function (jornadaIndex, eventoIdParam) {
    const eventoId = eventoIdParam || window.editingId;
    if (!eventoId) {
      mostrarAvisoSimple("Error", "No se pudo identificar el evento.", "⚠️");
      return;
    }

    const evento = window.allEventsData.find(e => e.id === eventoId);
    if (!evento) return;

    // Si venimos del formulario de edición sincronizamos jornadas, si no usamos las del evento
    if (window.editingId === eventoId && window._jornadasActuales) {
      evento.jornadas = [...window._jornadasActuales];
    }

    const jornada = evento.jornadas?.[jornadaIndex];
    if (!jornada) return;
    if (!jornada.checklist) jornada.checklist = [];

    const fecha = jornada.fecha
      ? new Date(jornada.fecha + "T00:00:00").toLocaleDateString("es-AR")
      : `Jornada ${jornadaIndex + 1}`;

    window.eventoChecklistActual = {
      ...jornada,
      id: eventoId,
      client: evento.client,
      date: jornada.fecha || evento.date,
      _esJornada: true,
      _jornadaIndex: jornadaIndex,
      _eventoReal: evento,
    };

    const titulo = document.getElementById("tituloModalChecklist");
    if (titulo) titulo.innerText = `📦 ${fecha} · ${evento.client}`;

    const modal = document.getElementById("modalChecklist");
    if (modal) { window.cambiarPestanaChecklist("checklist"); modal.style.display = "flex"; }
  };

  registerEventDetailModal({
    getAllEvents: () => window.allEventsData || [],
    setEditingId,
    renderStaffSelection,
    puedeEditarPresupuesto: () => puedeEditarPresupuesto(auth),
  });

  loadEvents(avisos);
  initSearch();
}

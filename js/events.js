import {
  puedeEditarPresupuesto,
  actualizarUIBudget,
  subirPresupuestoEvento,
  eliminarPresupuestoEvento,
  actualizarUIAlquiler,
  subirAlquilerEvento,
  eliminarAlquilerEvento,
  initPagosForm,
  resetPagosForm,
  agregarPago,
  guardarPagos,
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
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
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
  resetPagosForm();
}

// ===============================
// RENDER
// ===============================

function actualizarFiltrosMes(events) {
  const wrap = document.getElementById("filtrosMesWrap");
  const scroll = document.getElementById("filtrosMesScroll");
  if (!wrap || !scroll) return;

  const today = new Date().toLocaleDateString("sv").split("T")[0];
  const mesesSet = new Set();

  events.forEach((e) => {
    const fecha = e.esMultidia ? (e.jornadas?.[0]?.fecha || "") : (e.date || "");
    if (!fecha) return;
    const esPasado = fecha < today;
    const esCerrado = esPasado && e.paid === true;
    if (esCerrado) return; // los cerrados no aparecen en filtros normales
    const key = fecha.slice(0, 7); // "2026-04"
    mesesSet.add(key);
  });

  const meses = Array.from(mesesSet).sort();
  if (meses.length <= 1) { wrap.style.display = "none"; return; }

  wrap.style.display = "";

  const mesActivo = document.querySelector(".filtro-mes.active")?.dataset.mes || "";

  scroll.innerHTML = "";
  meses.forEach((key) => {
    const [anio, mes] = key.split("-");
    const label = new Date(Number(anio), Number(mes) - 1, 1)
      .toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filtro-mes" + (mesActivo === key ? " active" : "");
    btn.dataset.mes = key;
    btn.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    scroll.appendChild(btn);
  });
}

function rerenderEvents() {
  renderFilteredEvents(window.allEventsData || [], {
    updateStats,
    updateClientDatalist,
  });

  const term = document.getElementById("searchInput")?.value.toLowerCase().trim();
  const mesActivo = document.querySelector(".filtro-mes.active")?.dataset.mes || "";

  document.querySelectorAll(".event-card").forEach((card) => {
    const coincideCliente = !term || (card.dataset.cliente || "").includes(term);
    const coincideMes = !mesActivo || (card.dataset.mes || "") === mesActivo;
    card.style.display = coincideCliente && coincideMes ? "" : "none";
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
  eventData.pagos = window._getPagosEnEdicion ? window._getPagosEnEdicion() : [];

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
  eventData.pagos = window._getPagosEnEdicion ? window._getPagosEnEdicion() : [];

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
  const id = editingId || window._eventoPresupuestoActual?.id;
  if (!id) return;
  await eliminarPresupuestoEvento(id, { db, storage, auth });

  // Actualizar en memoria
  const evento = window._eventoPresupuestoActual;
  if (evento) {
    evento.presupuestoURL = null;
    evento.presupuestoNombre = null;
    evento.presupuestoPath = null;
  }
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

    actualizarFiltrosMes(window.allEventsData);
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
  const cobrado = eventosFiltrados.filter(e => e.paid === true).reduce((sum, e) => sum + Number(e.total || 0), 0);
  const porCobrar = totalMes - cobrado;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
  set("totalMes", `$${totalMes.toLocaleString()}`);
  set("eventosMes", eventosFiltrados.length);
  set("cobradoMes", `$${cobrado.toLocaleString()}`);
  set("porCobrarMes", `$${porCobrar.toLocaleString()}`);
}

// ===============================
// AVISO MODAL
// ===============================

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
  initJornadas();
  initMaps({ mostrarAvisoSimple });

  const avisos = initAvisos({
    mostrarAvisoSimple,
    onConfirmarRealizacion: async (evento, statusFinal) => {
      try {
        const eventoRef = doc(db, "events", evento.id);
        const snap = await getDoc(eventoRef);
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
        await updateDoc(eventoRef, { status: statusFinal, realizacionConfirmada: true });
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
    const place = document.getElementById("place")?.value;
    const notes = document.getElementById("notes")?.value;
    const hayDatos = client || date || place || notes;
    if (hayDatos) {
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
    const client = document.getElementById("client")?.value;
    const date = document.getElementById("date")?.value;
    const place = document.getElementById("place")?.value;
    const notes = document.getElementById("notes")?.value;
    const formVisible = document.getElementById("eventFormContainer")?.style.display !== "none";
    const hayDatos = client || date || place || notes;

    if (formVisible && hayDatos) {
      mostrarAvisoSimple(
        "¿Descartar cambios?",
        "Tenés datos cargados en el formulario. ¿Querés descartarlos y empezar uno nuevo?<br><br>" +
        `<button onclick="window.resetFormConfirmado()" class="btn-aviso-confirmar">Sí, descartar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Volver</button>`,
        "⚠️", false
      );
      return;
    }

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
    if (!editingId) {
      mostrarAvisoSimple("Para gestionar la checklist, primero guardá el evento.", "⚠️");
      return;
    }

    window._detalleEventoAbierto = editingId;
    window.abrirSelectorChecklist();
  });

  // Filtros
  document.addEventListener("change", (e) => {
    if (e.target.id === "monthFilter") updateStats(window.allEventsData || []);
  });

  document.getElementById("filtrosEventos")?.addEventListener("click", (e) => {
    const btnEstado = e.target.closest(".filtro-estado");
    if (btnEstado) {
      document.querySelectorAll(".filtro-estado").forEach(b => b.classList.remove("active"));
      btnEstado.classList.add("active");
      rerenderEvents();
      return;
    }

    const btnMes = e.target.closest(".filtro-mes");
    if (btnMes) {
      const yaActivo = btnMes.classList.contains("active");
      document.querySelectorAll(".filtro-mes").forEach(b => b.classList.remove("active"));
      if (!yaActivo) btnMes.classList.add("active");
      rerenderEvents();
    }
  });

  // Presupuesto
  const presupuestoFile = document.getElementById("presupuestoFile");
  const btnSubirPresupuesto = document.getElementById("btnSubirPresupuesto");
  const btnVerPresupuesto = document.getElementById("btnVerPresupuesto");
  const btnEliminarPresupuesto = document.getElementById("btnEliminarPresupuesto");

  document.getElementById("btnGenerarPresupuestoForm")?.addEventListener("click", () => {
    if (!editingId) {
      mostrarAvisoSimple("Evento no guardado", "Primero guardá el evento para poder generar el presupuesto.", "⚠️");
      return;
    }
    const evento = window.allEventsData.find(e => e.id === editingId);
    if (!evento) return;
    window._eventoPresupuestoActual = evento;
    window.abrirModalPresupuesto(evento);
  });

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

  // Pagos parciales
  window._initPagosForm = (id) => initPagosForm(id, { storage, db, auth });

  const btnAgregarPago = document.getElementById("btnAgregarPago");
  if (btnAgregarPago) {
    btnAgregarPago.addEventListener("click", () => {
      if (!editingId) {
        mostrarAvisoSimple("Evento sin guardar", "Primero guardá el evento para poder agregar pagos.", "⚠️");
        return;
      }
      agregarPago();
    });
  }

  window.guardarPagosEvento = async function () {
    await guardarPagos(editingId, { db });
  };

  // Alquileres
  const alquilerFile = document.getElementById("alquilerFile");
  const btnSubirAlquiler = document.getElementById("btnSubirAlquiler");
  const btnEliminarAlquiler = document.getElementById("btnEliminarAlquiler");

  if (btnSubirAlquiler && alquilerFile) {
    btnSubirAlquiler.addEventListener("click", () => {
      if (!editingId) {
        mostrarAvisoSimple("Evento no guardado", "Primero guardá el evento para poder adjuntar el archivo.", "⚠️");
        return;
      }
      alquilerFile.click();
    });
    alquilerFile.addEventListener("change", async () => {
      await subirAlquilerEvento(editingId, { storage, db, auth });
      alquilerFile.value = "";
    });
  }

  if (btnEliminarAlquiler) {
    btnEliminarAlquiler.addEventListener("click", () => {
      const ev = window.allEventsData.find(ev => ev.id === editingId);
      const nombreArchivo = ev?.alquilerNombre || "este archivo";
      mostrarAvisoSimple(
        "¿Eliminar archivo?",
        `¿Seguro que querés eliminar <strong>${nombreArchivo}</strong>?<br><br>` +
        `<button onclick="window.confirmarEliminarAlquiler()" class="btn-aviso-confirmar">Sí, eliminar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
        "🗑️", false
      );
    });
  }

  window.confirmarEliminarAlquiler = async function () {
    document.getElementById("modalAvisoSimple").style.display = "none";
    await eliminarAlquilerEvento(editingId, { db, storage, auth });
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

  const SERVICIO_BASE = `1 Responsable a cargo del servicio de catering.
Chef y ayudantes de cocina.
Camareros uno cada 10 invitados.
Personal para barras.
Dietas especiales: vegetariana, vegana y sin TACC (avisar con 72hs de anticipación).
ART de todo el personal.
Mesas redondas con mantelería.
Vajilla completa de loza blanca, vidrio, cerámica, madera y hierro.
Decoración con flores naturales.`;

  const MENU_BASE = {
    "Catering Completo": {
      recepcion: "Bruschettas montadas con champignones y panceta ahumada\nBruschettas montadas con bocconccinos y tomates asados",
      calentitos: "Empanaditas criollas\nEmpanaditas de queso de cabra y cebolla morada",
      primerPlato: "Degustación de fiambres y quesos de la provincia de Córdoba\nFrutos secos: almendras, nueces y pasas rubias",
      principal: "(*) Rolls de cabrito serrano con reducción de vegetales y hierbas frescas, acompañado de papas confitadas\n(*) Medallón de lomo sobre crema de hongos portobellos, acompañado de papas domino y tomates asados\nRoll de ave relleno con queso, pimiento y olivas negras bajo salsa de puerros, acompañado de papas rústicas\nBondiola de cerdo braseada a la cerveza negra con vegetales asados y puré de boniatos al curry",
      postre: "Queso en hebras, dulce de batata, zapallos, higos y quinotos en almíbar",
      bebidas: "Vinos blancos, rosados y tintos\nGaseosas línea Coca-Cola\nAgua mineral y con gas\nLimonada con menta y jengibre\nEspumantes\nFernet Branca y Chopp artesanal",
    },
    "Almuerzo/Cena formal": {
      recepcion: "Tabla de fiambres y quesos artesanales\nAceitunas marinadas y bastones de pan",
      calentitos: "Croquetas de queso y jamón\nBruschetas de tomate y albahaca",
      primerPlato: "Ensalada de rúcula con peras, nueces y queso azul\nCrema de calabaza con crocante de semillas",
      principal: "(*) Salmón al horno con mantequilla de limón y alcaparras, con puré de papas\n(*) Lomo al champignon con guarnición de vegetales asados\nPollo relleno con espinaca y ricotta bajo salsa de vegetales",
      postre: "Brownie de chocolate con helado artesanal\nFrutas frescas de estación",
      bebidas: "Vinos blancos y tintos\nAgua mineral y con gas\nGaseosas\nEspumantes para el brindis",
    },
    "Almuerzo/Cena informal": {
      recepcion: "Picada de fiambres y quesos\nAceitunas y tostadas",
      calentitos: "Empanadas criollas\nMiniMedialunas de jamón y queso",
      primerPlato: "Ensalada mixta\nPan casero",
      principal: "Pollo al horno con papas rústicas\nPasta fresca con salsa de tomate casero\nMilanesas napolitanas con ensalada",
      postre: "Flan casero con dulce de leche\nFrutas de estación",
      bebidas: "Gaseosas línea Coca-Cola\nAgua mineral\nVinos de la casa\nCerveza artesanal",
    },
    "Asado": {
      recepcion: "Achuras a la parrilla\nChoripanes artesanales\nMorcillas",
      calentitos: "",
      primerPlato: "Ensalada mixta\nEnsalada rusa\nPan casero",
      principal: "Costillar de cerdo a la cruz\nAsado de tira y vacío\nPollo entero a la parrilla\nChorizos y morcillas",
      postre: "Frutas frescas\nQueso y dulce",
      bebidas: "Vinos tintos\nCerveza artesanal\nGaseosas\nAgua mineral",
    },
    "Coffee": {
      recepcion: "",
      calentitos: "Medialunas de manteca\nSandwichitos de miga\nMiniempanadas",
      primerPlato: "",
      principal: "",
      postre: "Alfajores artesanales\nBrownie de chocolate\nFrutas frescas",
      bebidas: "Café, cortado y café con leche\nTé e infusiones\nJugo de naranja natural\nAgua mineral",
    },
    "Cumpleaños": {
      recepcion: "Bandejeo de canapés variados\nTabla de fiambres y quesos",
      calentitos: "Empanaditas\nMiniMedialunas",
      primerPlato: "Ensalada de hojas verdes con aderezo",
      principal: "Pollo relleno con guarnición\nPasta fresca con salsa\nEnsaladas varias",
      postre: "Torta de cumpleaños\nPostres individuales\nFrutas frescas",
      bebidas: "Vinos\nEspumantes para el brindis\nGaseosas\nAgua mineral",
    },
    "Cumpleaños de 15": {
      recepcion: "Bandejeo de finger foods elegantes\nTabla gourmet de quesos y fiambres",
      calentitos: "Blinis con salmón y crema\nBruschetas gourmet",
      primerPlato: "Ensalada caprese\nCrema de vegetales",
      principal: "(*) Lomo al champiñón\n(*) Pollo relleno con espinaca y ricotta\nPasta fresca con salsa de vegetales",
      postre: "Torta de 15 personalizada\nPostres individuales\nCanasta de macarons",
      bebidas: "Espumantes\nMocktails sin alcohol\nGaseosas\nAgua mineral",
    },
  };

  window.abrirModalPresupuesto = function (evento) {
    window._eventoPresupuestoActual = evento;

    const tipo = evento.type || "Catering Completo";
    const menu = MENU_BASE[tipo] || MENU_BASE["Catering Completo"];
    const fecha = evento.esMultidia && evento.jornadas?.length > 0
      ? evento.jornadas.map(j => j.fecha ? new Date(j.fecha + "T00:00:00").toLocaleDateString("es-AR") : "").filter(Boolean).join(" y ")
      : evento.date ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR") : "";
    const horario = evento.horaInicio ? `${evento.horaInicio} a ${evento.horaFin || ""}` : "";

    document.getElementById("presSeñores").value = evento.client || "";
    document.getElementById("presLugar").value = evento.place || "";
    document.getElementById("presFecha").value = fecha;
    document.getElementById("presInvitados").value = evento.guests ? `${evento.guests} invitados` : "";
    document.getElementById("presHorario").value = horario;
    document.getElementById("presRecepcion").value = menu.recepcion;
    document.getElementById("presCalentitos").value = menu.calentitos;
    document.getElementById("presPrimerPlato").value = menu.primerPlato;
    document.getElementById("presPrincipal").value = menu.principal;
    document.getElementById("presPostre").value = menu.postre;
    document.getElementById("presBebidas").value = menu.bebidas;
    document.getElementById("presServicio").value = SERVICIO_BASE;
    document.getElementById("presObservaciones").value = "Este es un modelo de presupuesto a modo informativo, el mismo puede ser modificado según las necesidades de cada cliente.\nTodos los precios son más IVA.\nRazón social: JOOLI S.A.S · CUIT 30-71668298-2\nEspecificaciones de pago: a convenir";
    document.getElementById("presPrecio").value = evento.total || "";

    document.getElementById("modalPresupuesto").style.display = "flex";
  };

  window.cerrarModalPresupuesto = function () {
    document.getElementById("modalPresupuesto").style.display = "none";
    window._eventoPresupuestoActual = null;
  };

  // Paste this into events.js replacing window.generarPDFPresupuesto

  // IMAGE DATA - gradient backgrounds per event type
  // =============================================
  // PRESUPUESTO - Agregar al inicio de events.js
  // =============================================

  // =============================================
  // PRESUPUESTO — pegar en events.js
  // =============================================

  const PRESUPUESTO_IMAGES = {
    "catering": "./images/presupuesto-catering.png",
    "asado": "./images/presupuesto-asado.png",
    "cumple": "./images/presupuesto-cumple.jpg",
    "coffee": "./images/presupuesto-coffee.png",
    "almuerzo": "./images/presupuesto-almuerzo.jpg",
    "quince": "./images/presupuesto-quince.jpg",
  };

  function getImageKey(tipo) {
    if (!tipo) return "catering";
    const t = tipo.toLowerCase();
    if (t.includes("asado")) return "asado";
    if (t.includes("15") || t.includes("quince")) return "quince";
    if (t.includes("cumplea")) return "cumple";
    if (t.includes("coffee")) return "coffee";
    if (t.includes("almuerzo") || t.includes("cena")) return "almuerzo";
    return "catering";
  }

  // Helper: carga imagen desde URL usando canvas → dataURL para jsPDF
  function loadImageAsDataURL(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 800;
          canvas.height = img.naturalHeight || 220;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src + "?t=" + Date.now();
    });
  }

  window.mostrarOpcionesPresupuesto = function (evento) {
    window._eventoPresupuestoActual = evento;

    const tienePresupuesto = !!evento.presupuestoURL;

    const verBtn = `
    <button onclick="window.open('${evento.presupuestoURL}', '_blank'); document.getElementById('modalOpcionesPresupuesto').style.display='none';" 
      class="form-submit-btn" style="background:#2980b9;">
      👁 Ver presupuesto
    </button>`;

    const eliminarBtn = `
    <button onclick="window.eliminarPresupuestoDesdeOpciones()" 
      class="form-submit-btn form-submit-btn--delete">
      🗑 Eliminar presupuesto
    </button>`;

    document.getElementById("modalOpcionesPresupuesto").querySelector("div").innerHTML = `
  <h3 style="margin-bottom:16px; color:#1a1a2e; font-size:16px; text-align:center;">📄 Presupuesto</h3>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
    ${tienePresupuesto ? `
    <button onclick="window.open('${evento.presupuestoURL}', '_blank'); document.getElementById('modalOpcionesPresupuesto').style.display='none';"
      style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 10px; background:#2980b9; border:none; border-radius:10px; cursor:pointer; color:white; font-size:13px; font-weight:700;">
      <span style="font-size:22px;">👁</span>Ver
    </button>` : ""}
    <button onclick="window.elegirOpcionPresupuesto('generar')"
      style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 10px; background:#d4af37; border:none; border-radius:10px; cursor:pointer; color:#111; font-size:13px; font-weight:700;">
      <span style="font-size:22px;">✏️</span>Generar
    </button>
    <button onclick="window.elegirOpcionPresupuesto('adjuntar')"
      style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 10px; background:#2c3e50; border:none; border-radius:10px; cursor:pointer; color:white; font-size:13px; font-weight:700;">
      <span style="font-size:22px;">📎</span>Adjuntar
    </button>
    ${tienePresupuesto ? `
    <button onclick="window.eliminarPresupuestoDesdeOpciones()"
      style="display:flex; flex-direction:column; align-items:center; gap:6px; padding:14px 10px; background:#c0392b; border:none; border-radius:10px; cursor:pointer; color:white; font-size:13px; font-weight:700;">
      <span style="font-size:22px;">🗑</span>Eliminar
    </button>` : ""}
  </div>
  <button onclick="document.getElementById('modalOpcionesPresupuesto').style.display='none'"
    style="width:100%; margin-top:12px; padding:10px; background:transparent; border:none; cursor:pointer; font-size:13px; color:#888;">
    Cancelar
  </button>
  <input type="file" id="presupuestoFileDetalle" accept=".pdf,image/*" style="display:none;">
`;

    document.getElementById("modalOpcionesPresupuesto").style.display = "flex";
  };

  window.eliminarPresupuestoDesdeOpciones = async function () {
    document.getElementById("modalOpcionesPresupuesto").style.display = "none";
    const evento = window._eventoPresupuestoActual;
    if (!evento) return;
    mostrarAvisoSimple(
      "¿Eliminar presupuesto?",
      `¿Seguro que querés eliminar el presupuesto de <strong>${evento.client}</strong>?<br><br>
    <button onclick="window.confirmarEliminarPresupuesto()" class="btn-aviso-confirmar">Sí, eliminar</button>
    <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
      "🗑", false
    );
  };

  window.elegirOpcionPresupuesto = async function (opcion) {
    document.getElementById("modalOpcionesPresupuesto").style.display = "none";
    const evento = window._eventoPresupuestoActual;
    if (!evento) return;

    if (opcion === "generar") {
      window.abrirModalPresupuesto(evento);
    } else {
      const eventoId = evento.id;
      const eventoCliente = evento.client;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".pdf,image/*";
      input.addEventListener("change", async function () {
        const file = this.files[0];
        if (!file) return;
        mostrarAvisoSimple("Subiendo...", "Esperá un momento.", "⏳", false);
        try {
          const storageRef = ref(storage, `presupuestos/${eventoId}/${file.name}`);
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          await updateDoc(doc(db, "events", eventoId), {
            presupuestoURL: url,
            presupuestoNombre: file.name,
            presupuestoPath: `presupuestos/${eventoId}/${file.name}`,
          });
          const enMemoria = (window.allEventsData || []).find(e => e.id === eventoId);
          if (enMemoria) {
            enMemoria.presupuestoURL = url;
            enMemoria.presupuestoNombre = file.name;
            enMemoria.presupuestoPath = `presupuestos/${eventoId}/${file.name}`;
          }
          document.getElementById("modalAvisoSimple").style.display = "none";
          mostrarAvisoSimple("Listo", "Presupuesto adjuntado correctamente.", "✅");
          setTimeout(() => {
            document.getElementById("modalAvisoSimple").style.display = "none";
            window.abrirModalDetalle(eventoId);
          }, 1500);
        } catch (e) {
          console.error("Error subiendo presupuesto:", e);
          mostrarAvisoSimple("Error", "No se pudo subir el presupuesto.", "❌");
        }
      });
      input.click();
    }
  };

  window.generarPDFPresupuesto = async function () {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const W = 210;
    const M = 16;
    const CW = W - M * 2;

    const señores = document.getElementById("presSeñores").value;
    const lugar = document.getElementById("presLugar").value;
    const fecha = document.getElementById("presFecha").value;
    const invitados = document.getElementById("presInvitados").value;
    const horario = document.getElementById("presHorario").value;
    const recepcion = document.getElementById("presRecepcion").value;
    const calentitos = document.getElementById("presCalentitos").value;
    const primerPlato = document.getElementById("presPrimerPlato").value;
    const principal = document.getElementById("presPrincipal").value;
    const postre = document.getElementById("presPostre").value;
    const bebidas = document.getElementById("presBebidas").value;
    const servicio = document.getElementById("presServicio").value;
    const obs = document.getElementById("presObservaciones").value;
    const precio = document.getElementById("presPrecio").value;
    const tipoPrecio = document.getElementById("presTipoPrecio").value;

    const eventoActual = window._eventoPresupuestoActual || null;
    const tipoEvento = eventoActual?.type || "Catering Completo";
    const imgKey = getImageKey(tipoEvento);
    const imgUrl = PRESUPUESTO_IMAGES[imgKey];

    const gold = [212, 175, 55];
    const dark = [22, 22, 38];
    const gray = [90, 90, 90];
    const lgray = [240, 238, 232];
    const white = [255, 255, 255];

    function sf(style, size, color) {
      pdf.setFont("helvetica", style);
      pdf.setFontSize(size);
      pdf.setTextColor(...(color || [0, 0, 0]));
    }

    function addFooter(pageNum) {
      pdf.setDrawColor(...gold);
      pdf.setLineWidth(0.3);
      pdf.line(M, 284, W - M, 284);
      sf("normal", 7.5, [160, 160, 160]);
      pdf.text("JOOLI Catering  ·  CUIT 30-71668298-2", M, 288);
      pdf.text(`Página ${pageNum}`, W - M, 288, { align: "right" });
    }

    function drawPageBorder() {
      pdf.setFillColor(...gold);
      pdf.rect(0, 0, 4, 297, "F");
    }

    const pageRef = { n: 1 };

    function checkPage(y, needed) {
      if (y + needed > 278) {
        addFooter(pageRef.n);
        pdf.addPage();
        pageRef.n++;
        drawPageBorder();
        return 18;
      }
      return y;
    }

    function bulletLines(text, x, y, maxW) {
      if (!text?.trim()) return y;
      const lines = text.split("\n").filter(l => l.trim());
      lines.forEach(line => {
        y = checkPage(y, 8);
        const isSpecial = line.startsWith("(*)");
        if (isSpecial) {
          sf("bolditalic", 9, [130, 95, 10]);
          const clean = line.replace("(*)", "").trim();
          const wrapped = pdf.splitTextToSize(`★ ${clean}`, maxW - 12);
          wrapped.forEach((l, i) => {
            if (i > 0) y = checkPage(y, 6);
            pdf.text(l, x + 4, y);
            if (i < wrapped.length - 1) y += 5;
          });
        } else {
          sf("normal", 9.5, gray);
          const wrapped = pdf.splitTextToSize(line, maxW - 12);
          pdf.setFillColor(...gold);
          pdf.circle(x + 1.5, y - 1.2, 0.8, "F");
          wrapped.forEach((l, i) => {
            if (i > 0) y = checkPage(y, 6);
            pdf.text(l, x + 4, y);
            if (i < wrapped.length - 1) y += 5;
          });
        }
        y += 6;
      });
      return y;
    }

    function sectionBar(title, y) {
      y = checkPage(y, 14);
      pdf.setFillColor(...dark);
      pdf.rect(M, y, CW, 8, "F");
      pdf.setFillColor(...gold);
      pdf.rect(M, y, 3, 8, "F");
      sf("bold", 9, white);
      pdf.text(title.toUpperCase(), M + 6, y + 5.5);
      return y + 12;
    }

    // ---- HEADER ----
    drawPageBorder();

    // Cargar imagen de fondo via canvas
    const bgDataUrl = await loadImageAsDataURL(imgUrl);
    if (bgDataUrl) {
      pdf.addImage(bgDataUrl, "JPEG", 0, 0, W, 58);
    } else {
      pdf.setFillColor(...dark);
      pdf.rect(0, 0, W, 58, "F");
    }

    // Overlay general
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new pdf.GState({ opacity: 0.15 }));
    pdf.rect(0, 0, W, 55, "F");
    pdf.setGState(new pdf.GState({ opacity: 1 }));

    // Barra dorada
    pdf.setFillColor(...gold);
    pdf.rect(0, 55, W, 3, "F");

    // Título (sin logo, ya está en la imagen)
    sf("bold", 16, [140, 100, 0]);
    pdf.setCharSpace(4);
    pdf.text("PRESUPUESTO", M, 52);
    pdf.setCharSpace(0);

    let y = 68;

    // ---- CARD CLIENTE ----
    pdf.setFillColor(...lgray);
    pdf.roundedRect(M, y, CW, 38, 2, 2, "F");
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(M, y, CW, 38, 2, 2, "S");
    pdf.setFillColor(...gold);
    pdf.rect(M, y, 4, 38, "F");

    const col1 = M + 8;
    const col2 = M + 8 + (CW / 2);

    y += 7;
    sf("bold", 7.5, [140, 100, 0]);
    pdf.text("SEÑORES", col1, y);
    sf("normal", 9.5, dark);
    pdf.text(pdf.splitTextToSize(señores || "-", CW / 2 - 8)[0], col1, y + 5);

    sf("bold", 7.5, [140, 100, 0]);
    pdf.text("LUGAR", col2, y);
    sf("normal", 9.5, dark);
    pdf.text(pdf.splitTextToSize(lugar || "-", CW / 2 - 8)[0], col2, y + 5);

    y += 14;
    sf("bold", 7.5, [140, 100, 0]);
    pdf.text("FECHA", col1, y);
    sf("normal", 9.5, dark);
    pdf.text(fecha || "-", col1, y + 5);

    sf("bold", 7.5, [140, 100, 0]);
    pdf.text("INVITADOS", col2, y);
    sf("normal", 9.5, dark);
    pdf.text(invitados || "-", col2, y + 5);

    y += 14;
    sf("bold", 7.5, [140, 100, 0]);
    pdf.text("HORARIO", col1, y);
    sf("normal", 9.5, dark);
    pdf.text(horario || "-", col1, y + 5);

    y += 14;

    // ---- MENU ----
    y += 4;
    sf("bold", 14, dark);
    pdf.text("MENÚ", M, y);
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(1.2);
    pdf.line(M, y + 2, M + 18, y + 2);
    pdf.setLineWidth(0.2);
    pdf.line(M + 19, y + 2, W - M, y + 2);
    y += 10;

    if (recepcion?.trim()) { y = sectionBar("Recepción — bandejeo por camareros", y); y = bulletLines(recepcion, M + 2, y, CW - 4); y += 2; }
    if (calentitos?.trim()) { y = sectionBar("Calentitos", y); y = bulletLines(calentitos, M + 2, y, CW - 4); y += 2; }
    if (primerPlato?.trim()) { y = sectionBar("Primer plato", y); y = bulletLines(primerPlato, M + 2, y, CW - 4); y += 2; }
    if (principal?.trim()) { y = sectionBar("Plato principal", y); y = bulletLines(principal, M + 2, y, CW - 4); y += 2; }
    if (postre?.trim()) { y = sectionBar("Postre", y); y = bulletLines(postre, M + 2, y, CW - 4); y += 2; }
    if (bebidas?.trim()) { y = sectionBar("Bebidas con y sin alcohol", y); y = bulletLines(bebidas, M + 2, y, CW - 4); y += 2; }

    // ---- SERVICIO ----
    y = checkPage(y, 20);
    y += 4;
    sf("bold", 14, dark);
    pdf.text("EL SERVICIO INCLUYE", M, y);
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(1.2);
    pdf.line(M, y + 2, M + 50, y + 2);
    pdf.setLineWidth(0.2);
    pdf.line(M + 51, y + 2, W - M, y + 2);
    y += 10;
    y = bulletLines(servicio, M + 2, y, CW - 4);

    // ---- PRECIO ----
    y = checkPage(y, 24);
    y += 6;
    pdf.setFillColor(...dark);
    pdf.roundedRect(M, y, CW, 16, 2, 2, "F");
    pdf.setDrawColor(...gold);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(M, y, CW, 16, 2, 2, "S");
    const precioTexto = precio
      ? (tipoPrecio === "persona"
        ? `Precio por persona: $${Number(precio).toLocaleString("es-AR")}`
        : `Precio total del evento: $${Number(precio).toLocaleString("es-AR")}`)
      : "Precio a convenir";
    sf("bold", 12, gold);
    pdf.text(precioTexto, W / 2, y + 10, { align: "center" });
    y += 22;

    // ---- OBSERVACIONES ----
    if (obs?.trim()) {
      y = checkPage(y, 20);
      y = sectionBar("Observaciones", y);
      sf("normal", 8.5, gray);
      obs.split("\n").filter(l => l.trim()).forEach(line => {
        y = checkPage(y, 6);
        const wrapped = pdf.splitTextToSize(`• ${line}`, CW - 6);
        wrapped.forEach(l => { pdf.text(l, M + 2, y); y += 5; });
      });
      y += 4;
    }

    // ---- CIERRE ----
    y = checkPage(y, 16);
    y += 6;
    sf("italic", 9, [160, 130, 40]);
    pdf.text("Gracias por elegirnos. Quedamos a su disposición para cualquier consulta.", W / 2, y, { align: "center" });

    addFooter(pageRef.n);

    const blob = pdf.output("blob");
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, "_blank");

    // Guardar en Firebase Storage
    const evento = window._eventoPresupuestoActual;
    if (evento?.id) {
      try {
        mostrarAvisoSimple("Guardando...", "Guardando el presupuesto...", "⏳", false);

        const { ref, uploadBytes, getDownloadURL, deleteObject } =
          await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");

        if (evento.presupuestoPath) {
          try { await deleteObject(ref(storage, evento.presupuestoPath)); } catch (e) { }
        }

        const path = `presupuestos/${evento.id}/presupuesto_${Date.now()}.pdf`;
        const storageRef = ref(storage, path);
        const file = new File([blob], "presupuesto.pdf", { type: "application/pdf" });

        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);

        await updateDoc(doc(db, "events", evento.id), {
          presupuestoURL: url,
          presupuestoNombre: "presupuesto.pdf",
          presupuestoPath: path,
        });

        const idx = window.allEventsData.findIndex(e => e.id === evento.id);
        if (idx !== -1) {
          window.allEventsData[idx].presupuestoURL = url;
          window.allEventsData[idx].presupuestoNombre = "presupuesto.pdf";
          window.allEventsData[idx].presupuestoPath = path;
          evento.presupuestoURL = url;
          evento.presupuestoNombre = "presupuesto.pdf";
          evento.presupuestoPath = path;
        }

        document.getElementById("modalAvisoSimple").style.display = "none";

        // Cerrar modal de presupuesto
        window.cerrarModalPresupuesto();

        // Actualizar info en el formulario de edición si está abierto
        const infoEl = document.getElementById("presupuestoInfo");
        if (infoEl) infoEl.textContent = "Archivo: presupuesto.pdf";

        const verBtn = document.getElementById("btnVerPresupuesto");
        if (verBtn) {
          verBtn.style.display = "inline-block";
          verBtn.onclick = () => window.open(url, "_blank");
        }

        const eliminarBtn = document.getElementById("btnEliminarPresupuesto");
        if (eliminarBtn) eliminarBtn.style.display = "inline-block";

        mostrarAvisoSimple("✅ Guardado", "El presupuesto fue generado y guardado correctamente.", "✅");
      } catch (e) {
        console.error("Error guardando presupuesto:", e);
        document.getElementById("modalAvisoSimple").style.display = "none";
      }
    }
  };



}

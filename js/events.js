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
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

let editingId = null;
window.allEventsData = [];

let eventoPendienteConfirmacion = null;
let modalConfirmacionAbierto = false;

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

window.resetFormConfirmado = function () {
  document.getElementById("modalAvisoSimple").style.display = "none";
  resetForm();
};

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
      actualizarUIBudget(null);
    });
  }

  const formTitle = document.getElementById("formTitle");
  const updateBtn = document.getElementById("updateBtn");
  const addBtn = document.getElementById("addBtn");

  if (formTitle) formTitle.innerText = "Nuevo Evento";
  if (updateBtn) updateBtn.style.display = "none";
  if (addBtn) addBtn.style.display = "inline-block";

  const deleteBtn = document.getElementById("deleteBtn");
  if (deleteBtn) deleteBtn.style.display = "none";
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
    placeUrl: document.getElementById("placeUrl")?.value || "",
    alquileres: {
      vajilla: document.getElementById("alqVajilla")?.checked || false,
      manteleria: document.getElementById("alqManteleria")?.checked || false,
      mobiliario: document.getElementById("alqMobiliario")?.checked || false,
      mobiliarioTrabajo: document.getElementById("alqMobiliarioTrabajo")?.checked || false,
      notas: document.getElementById("alqNotas")?.value || "",
    },
    presupuestoURL: document.getElementById("presupuestoURL")?.value.trim() || "",
    staffAsignado: selectedStaff,
  };
}

// ===============================
// CRUD EVENTOS
// ===============================
async function saveEvent() {
  const eventData = getFormData();

  if (!eventData.date || !eventData.client || !eventData.total) {
    mostrarAvisoSimple(
      "Faltan datos",
      "Por favor completá al menos <strong>fecha</strong>, <strong>cliente</strong> y <strong>total</strong> antes de guardar.",
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

    resetForm();
  } catch (error) {
    console.error("Error al guardar:", error);
  }
}

async function updateExistingEvent() {
  if (!editingId) return;

  const eventData = getFormData();

  if (!eventData.date || !eventData.client || !eventData.total) {
    mostrarAvisoSimple(
      "Faltan datos",
      "Por favor completá al menos <strong>fecha</strong>, <strong>cliente</strong> y <strong>total</strong> antes de guardar.",
      "⚠️"
    );
    return;
  }
  const userName = getCurrentUserName();
  const userEmail = auth.currentUser?.email;
  if (!puedeEditarPresupuesto()) {
    delete eventData.presupuestoURL;
  }

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
    verificarEventosPasados(window.allEventsData);
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
    "placeUrl",
  ];

  fields.forEach((field) => {
    const el = document.getElementById(field);
    if (el) {
      el.value = evento[field] || (field === "invoiceType" ? "B/C" : "");
    }
  });

  const alq = evento.alquileres || {};
  const alqVajilla = document.getElementById("alqVajilla");
  const alqManteleria = document.getElementById("alqManteleria");
  const alqMobiliario = document.getElementById("alqMobiliario");
  const alqMobiliarioTrabajo = document.getElementById("alqMobiliarioTrabajo");
  const alqNotas = document.getElementById("alqNotas");

  if (alqVajilla) alqVajilla.checked = alq.vajilla || false;
  if (alqManteleria) alqManteleria.checked = alq.manteleria || false;
  if (alqMobiliario) alqMobiliario.checked = alq.mobiliario || false;
  if (alqMobiliarioTrabajo) alqMobiliarioTrabajo.checked = alq.mobiliarioTrabajo || false;
  if (alqNotas) alqNotas.value = alq.notas || "";

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

  const deleteBtn = document.getElementById("deleteBtn");
  if (deleteBtn) {
    deleteBtn.style.display = "inline-block";
  }

  if (form) {
    form.style.display = "block";
    form.scrollIntoView({ behavior: "smooth" });
  }
  const verBtn = document.getElementById("btnVerPresupuesto");
  const eliminarBtn = document.getElementById("btnEliminarPresupuesto");
  const subirBtn = document.getElementById("btnSubirPresupuesto");
  const infoEl = document.getElementById("presupuestoInfo");
  const puedeEditar = puedeEditarPresupuesto();

  if (infoEl) {
    infoEl.textContent = evento.presupuestoNombre
      ? `Archivo: ${evento.presupuestoNombre}`
      : "No hay presupuesto adjunto.";
  }

  if (subirBtn) {
    subirBtn.style.display = puedeEditar ? "inline-block" : "none";
  }

  if (verBtn) {
    verBtn.style.display = evento.presupuestoURL ? "inline-block" : "none";
    verBtn.onclick = () => window.open(evento.presupuestoURL, "_blank");
  }

  if (eliminarBtn) {
    eliminarBtn.style.display = puedeEditar && evento.presupuestoURL ? "inline-block" : "none";
  }


}

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
    window.mostrarAvisoSimple("Sin selección", "Buscá y seleccioná un lugar primero.", "⚠️");
    return;
  }

  const placeInput = document.getElementById("place");
  if (placeInput) placeInput.value = place.nombre || place.direccion;

  // Guardamos el URL en un campo oculto
  let hidden = document.getElementById("placeUrl");
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "placeUrl";
    document.body.appendChild(hidden);
  }
  hidden.value = place.url || "";

  window.cerrarModalMaps();
};

// ===============================
// PRESUPUESTO
// ===============================

function puedeEditarPresupuesto() {
  const userEmail = auth.currentUser?.email || "";
  return userEmail === "almos2712@hotmail.com";
}


function actualizarUIBudget(evento) {
  const btnVer = document.getElementById("btnVerPresupuesto");
  const btnEliminar = document.getElementById("btnEliminarPresupuesto");
  const btnSubir = document.getElementById("btnSubirPresupuesto");
  const info = document.getElementById("presupuestoInfo");
  const puedeEditar = puedeEditarPresupuesto();

  if (!btnVer || !btnEliminar || !info) return;

  if (evento?.presupuestoURL) {
    btnVer.style.display = "inline-block";
    btnEliminar.style.display = puedeEditar ? "inline-block" : "none";
    info.textContent = `Archivo: ${evento.presupuestoNombre || "Presupuesto"}`;
  } else {
    btnVer.style.display = "none";
    btnEliminar.style.display = "none";
    info.textContent = "No hay presupuesto adjunto.";
  }

  if (btnSubir) {
    btnSubir.style.display = puedeEditar ? "inline-block" : "none";
  }
}

async function subirPresupuestoEvento(file) {
  if (!editingId) {
    mostrarAvisoSimple("Atención", "Primero guardá el evento para poder adjuntar el presupuesto.", "⚠️");
    return;
  }

  if (!file) return;

  const tiposPermitidos = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
  if (!tiposPermitidos.includes(file.type)) {
    mostrarAvisoSimple("Archivo no válido", "Solo se permiten archivos PDF o imágenes.", "⚠️");
    return;
  }

  try {
    const extension = file.name.split(".").pop();
    const path = `presupuestos/${editingId}/presupuesto.${extension}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    await updateDoc(doc(db, "events", editingId), {
      presupuestoURL: url,
      presupuestoNombre: file.name,
      presupuestoPath: path,
    });

    mostrarAvisoSimple("Listo", "Presupuesto subido correctamente.", "✅");

    const eventoActualizado = { ...window.allEventsData.find(ev => ev.id === editingId), presupuestoURL: url, presupuestoNombre: file.name };
    actualizarUIBudget(eventoActualizado);
  } catch (error) {
    console.error("Error al subir presupuesto:", error);
    mostrarAvisoSimple("Error", "No se pudo subir el presupuesto. Intentá de nuevo.", "❌");
  }
}

async function eliminarPresupuestoEvento() {
  if (!editingId) return;

  const eventoActual = window.allEventsData.find((ev) => ev.id === editingId);
  if (!eventoActual?.presupuestoPath) return;

  try {
    await deleteObject(ref(storage, eventoActual.presupuestoPath));

    await updateDoc(doc(db, "events", editingId), {
      presupuestoURL: "",
      presupuestoNombre: "",
      presupuestoPath: "",
    });

    mostrarAvisoSimple("Listo", "Presupuesto eliminado correctamente.", "✅");
  } catch (error) {
    console.error("Error al eliminar presupuesto:", error);
    mostrarAvisoSimple("Error", "No se pudo eliminar el presupuesto.", "❌");
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
  const monthFilter = document.getElementById("monthFilter")?.value;

  let eventosFiltrados = events;

  if (monthFilter) {
    eventosFiltrados = window.allEventsData.filter(e => {
      return e.date && e.date.startsWith(monthFilter);
    });
  } else {
    const today = new Date();
    const mesActual = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    eventosFiltrados = window.allEventsData.filter(e => {
      return e.date && e.date.startsWith(mesActual);
    });
  }

  eventosFiltrados = eventosFiltrados.filter(e => e.status !== "Cancelado");

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

async function confirmarRealizacionEvento(statusFinal) {
  if (!eventoPendienteConfirmacion) return;

  try {
    const ref = doc(db, "events", eventoPendienteConfirmacion.id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      alert("El evento ya no existe.");
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

// ===============================
// RENDER EVENTOS
// ===============================
export function renderFilteredEvents(events) {
  const eventsList = document.getElementById("eventsList");
  if (!eventsList) return;

  eventsList.innerHTML = "";

  const today = new Date().toISOString().split("T")[0];
  const mostrarCerrados =
    document.getElementById("mostrarCerrados")?.checked ?? false;
  const mostrarCancelados =
    document.getElementById("mostrarCancelados")?.checked ?? false;
  const estadoActivo = document.querySelector(".filtro-estado.active")?.dataset.estado || "";

  events = events.filter((e) => {
    const esPasado = e.date < today;
    const esCerrado = esPasado && e.paid === true;
    const esCancelado = e.status === "Cancelado";

    if (!mostrarCerrados && esCerrado) return false;
    if (!mostrarCancelados && esCancelado) return false;
    if (estadoActivo && e.status !== estadoActivo) return false;

    return true;
  });

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
  const today = new Date().toISOString().split("T")[0];
  const esHoy = evento.date === today;
  const bordeEvento = esHoy ? "4px solid #e74c3c" : "4px solid transparent";

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

  const invoiceIndicator = evento.invoiceType === "A"
    ? `<span style="background:#34495e; color:white; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-left:5px;">FACT A</span>`
    : "";

  const alquileresTexto = evento.alquileres && Object.values(evento.alquileres).some(v => v === true)
    ? [
      evento.alquileres.vajilla ? "Vajilla" : null,
      evento.alquileres.manteleria ? "Mantelería" : null,
      evento.alquileres.mobiliario ? "Mobiliario" : null,
      evento.alquileres.mobiliarioTrabajo ? "Mob. trabajo" : null,
    ].filter(Boolean).join(" · ")
    : null;

  return `
    <div class="card" data-id="${id}" style="cursor:pointer; border:1px solid #ddd; border-left:${bordeEvento}; padding:12px; border-radius:8px; margin-bottom:10px; background:white;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex-grow:1;">
          <small style="color:#555; font-weight:bold;">${formatDate(evento.date)}</small>${invoiceIndicator}<br>
          <strong style="font-size:1.2em; color:#111;">${evento.client}</strong><br>
          <small style="color:#d4af37; font-weight:bold;">${evento.type}</small>
        </div>
        <span style="${statusStyle}">${evento.status}</span>
      </div>
      <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
        ${evento.paid ? `<span style="padding:3px 8px; background:#27ae60; color:white; border-radius:6px; font-size:0.72em; font-weight:bold;">💰 COBRADO</span>` : ""}
        ${alquileresTexto ? `<span style="padding:3px 8px; background:#fdebd0; color:#e67e22; border-radius:6px; font-size:0.72em; font-weight:bold;">🪑 ${alquileresTexto}</span>` : ""}
        ${evento.ultimoCambioPor ? `<span style="font-size:0.75em; color:#999;">✏️ ${evento.ultimoCambioPor}</span>` : ""}
      </div>
      <div style="margin-top:10px; display:flex; gap:8px; border-top:1px solid #f0ece3; padding-top:10px;">
        <button
          onclick="event.stopPropagation(); window.abrirModalGestionStaff('${id}');"
          style="
            flex:1; padding:7px; background:#9b59b6;
            border:none; border-radius:8px;
            font-size:12px; font-weight:600; color:white;
            cursor:pointer;
          "
        >👥 Staff</button>
        <button
          onclick="event.stopPropagation(); window.abrirModalChecklist('${id}');"
          style="
            flex:1; padding:7px; background:#16a085;
            border:none; border-radius:8px;
            font-size:12px; font-weight:600; color:white;
            cursor:pointer;
          "
        >📦 Checklist</button>
      </div>
    </div>
  `;
}

async function eliminarEvento() {
  if (!editingId) return;

  const eventoActual = window.allEventsData.find(ev => ev.id === editingId);
  const nombreEvento = eventoActual?.client || "este evento";

  mostrarAvisoSimple(
    "¿Eliminar evento?",
    `¿Seguro que querés eliminar el evento de <strong>${nombreEvento}</strong>? Esta acción no se puede deshacer.<br><br>` +
    "<button onclick=\"window.confirmarEliminarEvento()\" style=\"" +
    "padding:10px 20px; background:#c0392b; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600; margin-right:8px;" +
    "\">Sí, eliminar</button>" +
    "<button onclick=\"document.getElementById('modalAvisoSimple').style.display='none'\" style=\"" +
    "padding:10px 20px; background:#95a5a6; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600;" +
    "\">Cancelar</button>",
    "🗑",
    false
  );
}

window.confirmarEliminarEvento = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";

  try {
    await deleteDoc(doc(db, "events", editingId));
    resetForm();
  } catch (error) {
    console.error("Error al eliminar evento:", error);
    mostrarAvisoSimple("Error", "No se pudo eliminar el evento. Intentá de nuevo.", "❌");
  }
};
window.abrirModalDetalle = function (eventoId) {
  const evento = window.allEventsData.find(ev => ev.id === eventoId);
  if (!evento) return;

  const colors = {
    Presupuestado: "#f1c40f",
    "Seña pagada": "#e67e22",
    Confirmado: "#27ae60",
    Realizado: "#2980b9",
    Cancelado: "#c0392b",
  };

  const staff = evento.mensajesEnviados || [];
  const confirmados = staff.filter(m => m.estado === "confirmado").length;
  const pendientes = staff.filter(m => m.estado === "pendiente").length;
  const rechazados = staff.filter(m => m.estado === "rechazado").length;
  const totalAsignados = confirmados + pendientes;
  const staffNecesario = Number(evento.staffNecesario || 0);
  const faltanMozos = Math.max(staffNecesario - totalAsignados, 0);

  let textoStaff = `Sin staff asignado`;
  let colorStaff = "#c0392b";
  if (totalAsignados > 0 && faltanMozos === 0) { textoStaff = `Staff completo ✔`; colorStaff = "#27ae60"; }
  else if (totalAsignados > 0 && faltanMozos === 1) { textoStaff = `Falta 1 mozo`; colorStaff = "#f39c12"; }
  else if (totalAsignados > 0) { textoStaff = `Faltan ${faltanMozos} mozos`; colorStaff = "#f39c12"; }

  const contenido = document.getElementById("detalleContenido");
  if (contenido) {
    contenido.innerHTML = `
      <div style="margin-bottom:12px; padding-right:30px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div style="font-size:0.85em; color:#555; font-weight:bold;">${formatDate(evento.date)}</div>
          <span style="
            background:${colors[evento.status] || "#666"};
            color:white; padding:4px 10px;
            border-radius:12px; font-size:0.75em;
            font-weight:bold; white-space:nowrap;
          ">${evento.status}</span>
        </div>
        <div style="font-size:1.3em; font-weight:bold; color:#111;">${evento.client}</div>
        <div style="font-size:0.85em; color:#d4af37; font-weight:bold;">${evento.type}</div>
      </div>

      <div style="font-size:0.9em; color:#333; line-height:2;">
        📍 <strong>${evento.place || "-"}</strong><br>
        👥 <strong>${evento.guests || "-"}</strong> personas<br>
        🕒 Evento: <strong>${evento.horaInicio || "-"}</strong> a <strong>${evento.horaFin || "-"}</strong><br>
        👔 Presentación: <strong>${evento.horaPresentacion || "-"}</strong><br>
        💰 Total: <strong>$${Number(evento.total || 0).toLocaleString()}</strong>
        ${evento.paid ? `<span style="background:#27ae60; color:white; padding:2px 8px; border-radius:6px; font-size:0.8em; margin-left:6px;">COBRADO</span>` : ""}<br>
        💵 Seña: <strong>$${Number(evento.deposit || 0).toLocaleString()}</strong><br>
        👥 <span style="color:${colorStaff}; font-weight:bold;">${textoStaff}</span>
        <span style="color:#888;"> · ✔ ${confirmados} · ⏳ ${pendientes} · ❌ ${rechazados}</span>
        ${evento.notes ? `<br>📝 <em style="color:#666;">${evento.notes}</em>` : ""}
        ${evento.invoiceNumber ? `<br>🧾 Factura: <strong>${evento.invoiceType || ""} ${evento.invoiceNumber}</strong>` : ""}
        ${evento.alquileres && Object.values(evento.alquileres).some(v => v === true) ? `
          <br>🪑 <span style="color:#e67e22; font-weight:600;">Alquileres: ${[
          evento.alquileres.vajilla ? "Vajilla" : null,
          evento.alquileres.manteleria ? "Mantelería" : null,
          evento.alquileres.mobiliario ? "Mobiliario" : null,
          evento.alquileres.mobiliarioTrabajo ? "Mob. trabajo" : null,
        ].filter(Boolean).join(" · ")}</span>
          ${evento.alquileres.notas ? `<br><span style="font-size:0.9em; color:#888;">📋 ${evento.alquileres.notas}</span>` : ""}
` : ""}
      </div>
    `;
  }

  const editarBtn = document.getElementById("detalleEditarBtn");
  const staffBtn = document.getElementById("detalleStaffBtn");
  const checklistBtn = document.getElementById("detalleChecklistBtn");
  const presupuestoBtn = document.getElementById("detallePresupuestoBtn");

  if (editarBtn) editarBtn.onclick = () => {
    window.cerrarModalDetalle();
    fillFormForEdit(evento, eventoId);
  };
  if (staffBtn) staffBtn.onclick = () => {
    window.cerrarModalDetalle();
    window.abrirModalGestionStaff(eventoId);
  };
  if (checklistBtn) checklistBtn.onclick = () => {
    window.cerrarModalDetalle();
    window.abrirModalChecklist(eventoId);
  };
  if (presupuestoBtn) {
    if (evento.presupuestoURL) {
      presupuestoBtn.style.display = "flex";
      presupuestoBtn.onclick = () => window.open(evento.presupuestoURL, "_blank");
    } else {
      presupuestoBtn.style.display = "none";
    }
  }

  document.getElementById("modalDetalleEvento").style.display = "flex";
};

window.cerrarModalDetalle = function () {
  document.getElementById("modalDetalleEvento").style.display = "none";
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
        "<button onclick=\"window.resetFormConfirmado()\" style=\"" +
        "padding:10px 20px; background:#e74c3c; color:white; border:none; " +
        "border-radius:8px; cursor:pointer; font-weight:600; margin-right:8px;" +
        "\">Sí, cancelar</button>" +
        "<button onclick=\"document.getElementById('modalAvisoSimple').style.display='none'\" style=\"" +
        "padding:10px 20px; background:#95a5a6; color:white; border:none; " +
        "border-radius:8px; cursor:pointer; font-weight:600;" +
        "\">Volver</button>",
        "⚠️",
        false
      );
    } else {
      resetForm();
    }
  });
  document.getElementById("addBtn")?.addEventListener("click", saveEvent);
  document.getElementById("updateBtn")?.addEventListener("click", updateExistingEvent);
  document.getElementById("btnUbicar")?.addEventListener("click", window.abrirModalMaps);
  document.getElementById("showFormBtn")?.addEventListener("click", () => {
    resetForm();

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
      alert("Para gestionar el staff, primero guarda el evento o selecciónalo desde la lista.");
    }
  });

  document.getElementById("eventsList")?.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card) return;

    const id = card.dataset.id;
    if (id) window.abrirModalDetalle(id);
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
      alert("Para gestionar la checklist, primero guarda el evento o selecciónalo desde la lista.");
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
    if (
      e.target.id === "mostrarCerrados" ||
      e.target.id === "mostrarCancelados"
    ) {
      renderFilteredEvents(window.allEventsData || []);
    }
    if (e.target.id === "monthFilter") {
      updateStats(window.allEventsData || []);
    }
  });

  document.getElementById("filtrosEventos")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".filtro-estado");
    if (!btn) return;

    document.querySelectorAll(".filtro-estado").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderFilteredEvents(window.allEventsData || []);
  });

  const presupuestoFile = document.getElementById("presupuestoFile");
  const btnSubirPresupuesto = document.getElementById("btnSubirPresupuesto");
  const btnVerPresupuesto = document.getElementById("btnVerPresupuesto");
  const btnEliminarPresupuesto = document.getElementById("btnEliminarPresupuesto");

  if (btnSubirPresupuesto && presupuestoFile) {
    btnSubirPresupuesto.addEventListener("click", () => {
      if (!editingId) {
        alert("Primero guarda el evento para poder adjuntar el presupuesto.");
        return;
      }
      presupuestoFile.click();
    });

    presupuestoFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      await subirPresupuestoEvento(file);
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
    btnEliminarPresupuesto.addEventListener("click", async () => {
      await eliminarPresupuestoEvento();
    });
  }

  loadEvents();
  initSearch();
}
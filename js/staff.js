import { db } from "./auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let unsubscribeListaStaff = null;
let staffInitDone = false;
let staffCache = [];

// ===============================
// HELPERS
// ===============================
function normalizarNombreStaff(item) {
  return typeof item === "object" ? item.nombre : item;
}

function obtenerEstadoStaff(item) {
  return typeof item === "object" ? item.estado || "pendiente" : "pendiente";
}

function obtenerWhatsappEnviado(item) {
  return typeof item === "object" ? item.whatsappEnviado || false : false;
}

function obtenerTelefonoStaff(item) {
  return typeof item === "object" ? item.telefono || "" : "";
}

function escapeHtml(texto) {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ordenarStaff(lista) {
  const ordenEstados = {
    confirmado: 0,
    pendiente: 1,
    rechazado: 2,
  };

  return [...lista].sort((a, b) => {
    const estadoA = obtenerEstadoStaff(a);
    const estadoB = obtenerEstadoStaff(b);

    const diffEstado = (ordenEstados[estadoA] ?? 99) - (ordenEstados[estadoB] ?? 99);
    if (diffEstado !== 0) return diffEstado;

    const nombreA = normalizarNombreStaff(a).toLowerCase();
    const nombreB = normalizarNombreStaff(b).toLowerCase();

    return nombreA.localeCompare(nombreB, "es");
  });
}

// ===============================
// STAFF GENERAL (ABM)
// ===============================
export async function guardarMozo() {
  const nombreInput = document.getElementById("mozoNombre");
  const telefonoInput = document.getElementById("mozoTelefono");

  if (!nombreInput || !telefonoInput) return;

  const nombre = nombreInput.value.trim();
  const telefono = telefonoInput.value.trim();

  if (!nombre || !telefono) {
    alert("Completa todos los campos");
    return;
  }

  try {
    await addDoc(collection(db, "staff"), {
      nombre,
      telefono,
      createdAt: new Date(),
    });

    nombreInput.value = "";
    telefonoInput.value = "";
  } catch (e) {
    console.error("Error guardando staff:", e);
  }
}

window.borrarMozo = async function (id) {
  if (!confirm("¿Seguro que querés eliminar a este mozo?")) return;

  try {
    await deleteDoc(doc(db, "staff", id));
  } catch (e) {
    console.error("Error eliminando staff:", e);
  }
};

function renderStaffList(snapshot) {
  const listaDiv = document.getElementById("listaStaff");
  if (!listaDiv) return;

  let html = "";

  snapshot.forEach((docSnap) => {
    const mozo = docSnap.data();

    html += `
      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        background:#f8f9fa;
        padding:8px;
        margin-bottom:5px;
        border-radius:5px;
        font-size:0.9em;
      ">
        <div>
          <strong>${escapeHtml(mozo.nombre)}</strong><br>
          <small style="color:#666;">${escapeHtml(mozo.telefono)}</small>
        </div>

        <button
          onclick="borrarMozo('${docSnap.id}')"
          style="
            background:none;
            border:none;
            color:#e74c3c;
            cursor:pointer;
            font-size:1.2em;
          ">
          🗑️
        </button>
      </div>
    `;
  });

  listaDiv.innerHTML = html;
}

export function cargarListaStaff() {
  const listaDiv = document.getElementById("listaStaff");
  if (!listaDiv) return;

  if (unsubscribeListaStaff) {
    unsubscribeListaStaff();
  }

  const q = query(collection(db, "staff"), orderBy("nombre", "asc"));

  unsubscribeListaStaff = onSnapshot(q, (snapshot) => {
    staffCache = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    renderStaffList(snapshot);
  });
}

window.abrirModal = function () {
  const modal = document.getElementById("staffModal");
  if (!modal) return;

  modal.style.display = "flex";
  cargarListaStaff();
};

window.cerrarModal = function () {
  const modal = document.getElementById("staffModal");
  if (!modal) return;

  modal.style.display = "none";
};

// ===============================
// STAFF EN FORMULARIO DE EVENTO
// ===============================
export async function renderStaffSelection() {
  const container = document.getElementById("staffCheckboxes");
  if (!container) return;

  try {
    let staffData = staffCache;

    if (staffData.length === 0) {
      const q = query(collection(db, "staff"), orderBy("nombre"));
      const snapshot = await getDocs(q);

      staffData = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      staffCache = staffData;
    }

    container.innerHTML = "";

    if (staffData.length === 0) {
      container.innerHTML =
        "<small style='padding:10px;'>No hay staff cargado</small>";
      return;
    }

    let html = "";

    staffData.forEach((data) => {
      html += `
        <label style="display:block; margin-bottom:5px; cursor:pointer;">
          <input
            type="checkbox"
            name="staffSelected"
            value="${data.id}"
            data-nombre="${escapeHtml(data.nombre)}"
            data-tel="${escapeHtml(data.telefono)}"
            style="margin-right:8px;"
          >
          ${escapeHtml(data.nombre)}
        </label>
      `;
    });

    container.innerHTML = html;
  } catch (e) {
    console.error("Error cargando staff:", e);
  }
}

function hayCambiosSinGuardarEvento(evento) {
  const editEventId = window.editingId || "";

  // Si no se está editando este evento, no bloquear
  if (!editEventId || editEventId !== evento.id) return false;

  const dateForm = document.getElementById("date")?.value || "";
  const placeForm = document.getElementById("place")?.value || "";
  const horaInicioForm = document.getElementById("horaInicio")?.value || "";
  const horaFinForm = document.getElementById("horaFin")?.value || "";

  return (
    dateForm !== (evento.date || "") ||
    placeForm !== (evento.place || "") ||
    horaInicioForm !== (evento.horaInicio || "") ||
    horaFinForm !== (evento.horaFin || "")
  );
}


// ===============================
// MODAL GESTIÓN DE STAFF EN EVENTO
// ===============================
window.abrirModalGestionStaff = async function (eventId) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento) return;
  if (hayCambiosSinGuardarEvento(evento)) {
    alert("Primero presioná 'Actualizar evento' para guardar los cambios antes de gestionar el staff.");
    return;
  }

  const inputHoraPresentacion = document.getElementById("horaPresentacionEvento");

  if (inputHoraPresentacion) {
    // Si no hay horaPresentacion guardada pero sí hay horaInicio, calcular 2 horas antes
    if (!evento.horaPresentacion && evento.horaInicio) {
      const [h, m] = evento.horaInicio.split(":").map(Number);
      const totalMin = h * 60 + m - 120;
      const minDia = 24 * 60;
      const ajustado = (totalMin + minDia) % minDia;

      const hh = String(Math.floor(ajustado / 60)).padStart(2, "0");
      const mm = String(ajustado % 60).padStart(2, "0");
      const horaCalculada = `${hh}:${mm}`;

      try {
        await updateDoc(doc(db, "events", eventId), {
          horaPresentacion: horaCalculada,
        });

        evento.horaPresentacion = horaCalculada;
      } catch (e) {
        console.error("Error guardando hora de presentación calculada:", e);
      }
    }

    inputHoraPresentacion.value = evento.horaPresentacion || "";

    inputHoraPresentacion.onchange = async function () {
      const nuevaHora = this.value;

      try {
        await updateDoc(doc(db, "events", eventId), {
          horaPresentacion: nuevaHora,
        });

        evento.horaPresentacion = nuevaHora;
      } catch (e) {
        console.error("Error guardando hora de presentación:", e);
      }
    };
  }

  const modal = document.getElementById("modalGestionStaff");
  const container = document.getElementById("listaGestionStaffContenido");
  const titulo = document.getElementById("tituloModalStaff");
  const resumen = document.getElementById("resumenStaffEvento");

  if (!modal || !container || !titulo) return;

  modal.dataset.eventId = eventId;
  const fechaEvento = evento.date
    ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
    : "";

  titulo.innerText = `📅 ${fechaEvento} · ${evento.client}`;

  const mensajes = ordenarStaff(evento.mensajesEnviados || []);
  const panelSeleccion = document.getElementById("contenedorSeleccionStaff");
  const seleccionAbierta =
    panelSeleccion && panelSeleccion.style.display !== "none";
  const totalStaffNecesario = Number(evento.staffNecesario || 0);

  const totalStaffAsignado = mensajes.filter(
    (m) => obtenerEstadoStaff(m) !== "rechazado"
  ).length;

  const staffCompleto =
    totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario;

  const botonAgregar = document.getElementById("btnAbrirSeleccion");
  if (botonAgregar) {
    if (seleccionAbierta) {
      botonAgregar.disabled = false;
      botonAgregar.innerText = "Cancelar";
      botonAgregar.classList.remove("completo");
    } else {
      botonAgregar.disabled = staffCompleto;
      botonAgregar.innerText = staffCompleto ? "Completo" : "+ Agregar";

      if (staffCompleto) {
        botonAgregar.classList.add("completo");
      } else {
        botonAgregar.classList.remove("completo");
      }
    }
  }
  const totalStaff = mensajes.length;
  const confirmados = mensajes.filter(
    (m) => obtenerEstadoStaff(m) === "confirmado"
  ).length;
  const pendientes = mensajes.filter(
    (m) => obtenerEstadoStaff(m) === "pendiente"
  ).length;

  const rechazados = mensajes.filter(
    (m) => obtenerEstadoStaff(m) === "rechazado"
  ).length;


  const staffNecesario = Number(evento.staffNecesario || 0);
  const activos = confirmados + pendientes;
  const faltan = Math.max(staffNecesario - activos, 0);

  let colorEstado = "#27ae60"; // verde

  if (activos === 0) {
    colorEstado = "#c0392b"; // rojo
  } else if (faltan > 0) {
    colorEstado = "#f39c12"; // amarillo
  }

  if (resumen) {
    let linea1 = "Sin staff asignado";

    if (totalStaff > 0) {
      linea1 =
        `${confirmados} confirmados · ${pendientes} pendientes` +
        (rechazados > 0 ? ` · ${rechazados} rechazados` : "");
    }

    let linea2 = "";
    if (staffNecesario > 0) {
      linea2 = `
        <span style="color:${colorEstado}; font-weight:600;">
          👥 ${staffNecesario} · ✔ ${activos} · ➕ ${faltan}
        </span>
      `;
    }

    resumen.innerHTML = linea2 ? `${linea1}<br>${linea2}` : linea1;
  }

  if (mensajes.length === 0) {
    container.innerHTML =
      "<p style='text-align:center; color:#666;'>No hay staff asignado todavía.</p>";
  } else {
    container.innerHTML = mensajes
      .map((m) => {
        const nombre = normalizarNombreStaff(m);
        const estado = obtenerEstadoStaff(m);
        const whatsappEnviado = obtenerWhatsappEnviado(m);

        return `
          <div class="staff-item ${seleccionAbierta ? "staff-disabled" : ""}">
            <div class="staff-info">
              <button
                class="staff-status-dot status-${estado}"
                onclick="window.rotarEstado('${eventId}','${nombre}')"
                ${seleccionAbierta ? "disabled" : ""}
                title="${estado}"
              >
                ●
              </button>

              <span class="staff-name">${escapeHtml(nombre)}</span>
            </div>

            <div class="staff-actions">

              <button
                class="btn-icon wa"
                onclick="window.enviarWhatsApp('${eventId}','${nombre}')"
                ${seleccionAbierta ? "disabled" : ""}
                title="Enviar WhatsApp"
              >
                ${whatsappEnviado
            ? '<i class="fa-solid fa-check"></i>'
            : '<i class="fa-brands fa-whatsapp"></i>'
          }
              </button>

              <button
                class="btn-icon danger"
                onclick="window.quitarStaff('${eventId}','${nombre}')"
                ${seleccionAbierta ? "disabled" : ""}
                title="Quitar"
              >
                ✕
              </button>
            </div>
          </div>
        `;
      })
      .join("");
  }

  modal.style.display = "flex";
};

window.cerrarModalGestionStaff = function () {
  const modal = document.getElementById("modalGestionStaff");
  const panel = document.getElementById("contenedorSeleccionStaff");
  const boton = document.getElementById("btnAbrirSeleccion");
  const listaStaff = document.getElementById("listaGestionStaffContenido");
  const btnCerrarModal = document.getElementById("btnCerrarModalStaff");
  if (btnCerrarModal) btnCerrarModal.style.display = "inline-flex";

  if (panel) panel.style.display = "none";
  if (boton) boton.innerText = "+ Agregar";
  if (listaStaff) listaStaff.classList.remove("staff-disabled");
  if (modal) modal.style.display = "none";
};

// ===============================
// ASIGNAR STAFF A EVENTO
// ===============================
async function togglePanelSeleccionStaff() {
  const panel = document.getElementById("contenedorSeleccionStaff");
  const boton = document.getElementById("btnAbrirSeleccion");
  const listado = document.getElementById("listadoCheckboxesCompleto");
  const modal = document.getElementById("modalGestionStaff");
  const listaStaff = document.getElementById("listaGestionStaffContenido");
  const btnCerrarModal = document.getElementById("btnCerrarModalStaff");

  if (!panel || !boton || !listado || !modal || !listaStaff) return;

  const eventId = modal.dataset.eventId;
  const evento = window.allEventsData.find((e) => e.id === eventId);

  if (!evento) return;

  const totalStaffNecesario = Number(evento.staffNecesario || 0);
  const totalStaffAsignado = (evento.mensajesEnviados || []).filter(
    (m) => obtenerEstadoStaff(m) !== "rechazado"
  ).length;

  if (totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario) {
    alert("El staff de este evento ya está completo.");
    return;
  }

  const staffYaAsignado = (evento.mensajesEnviados || []).map((m) =>
    normalizarNombreStaff(m)
  );

  let staffDisponiblesData = staffCache;

  if (staffDisponiblesData.length === 0) {
    const q = query(collection(db, "staff"), orderBy("nombre"));
    const snapshot = await getDocs(q);

    staffDisponiblesData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    staffCache = staffDisponiblesData;
  }

  const staffDisponibles = staffDisponiblesData.filter((data) => {
    return !staffYaAsignado.includes(data.nombre);
  });

  if (
    (panel.style.display === "none" || panel.style.display === "") &&
    staffDisponibles.length === 0
  ) {
    alert("Todos los mozos ya fueron asignados a este evento.");
    return;
  }

  if (panel.style.display === "none" || panel.style.display === "") {
    let html = "";
    let hayDisponibles = false;

    staffDisponibles.forEach((data) => {

      if (!staffYaAsignado.includes(data.nombre)) {
        hayDisponibles = true;

        html += `
          <label style="
            display:flex;
            align-items:center;
            gap:15px;
            padding:12px;
            border-bottom:1px solid #f0f0f0;
            cursor:pointer;
            transition:background 0.2s;
          ">
            <input
              type="checkbox"
              class="check-staff-asignar"
              data-nombre="${escapeHtml(data.nombre)}"
              data-tel="${escapeHtml(data.telefono)}"
              style="width:18px; height:18px; cursor:pointer;"
            >
            <span style="font-size:15px; font-weight:500; color:#444;">
              ${escapeHtml(data.nombre)}
            </span>
          </label>
        `;
      }
    });

    listado.innerHTML = hayDisponibles
      ? html
      : "<p style='padding:10px;color:#888;'>Todos los mozos ya han sido asignados a este evento.</p>";

    panel.style.display = "block";
    boton.innerText = "Cancelar";
    listaStaff.classList.add("staff-disabled");
    if (btnCerrarModal) btnCerrarModal.style.display = "none";
    window.abrirModalGestionStaff(eventId);
  } else {
    panel.style.display = "none";
    boton.innerText = "+ Agregar";
    listaStaff.classList.remove("staff-disabled");
    if (btnCerrarModal) btnCerrarModal.style.display = "inline-flex";
    window.abrirModalGestionStaff(eventId);
  }
}

async function confirmarAsignacionStaff() {
  const modal = document.getElementById("modalGestionStaff");
  const panel = document.getElementById("contenedorSeleccionStaff");
  const boton = document.getElementById("btnAbrirSeleccion");
  const listaStaff = document.getElementById("listaGestionStaffContenido");
  const btnCerrarModal = document.getElementById("btnCerrarModalStaff");

  if (!modal) return;

  const eventId = modal.dataset.eventId;
  if (!eventId) {
    console.error("Error: eventId no definido en el modal.");
    return;
  }

  const checks = document.querySelectorAll(".check-staff-asignar:checked");
  if (checks.length === 0) {
    alert("Seleccioná al menos a alguien.");
    return;
  }

  const nuevosAsignados = Array.from(checks).map((c) => ({
    nombre: c.dataset.nombre,
    telefono: c.dataset.tel,
    estado: "pendiente",
    whatsappEnviado: false,
  }));

  const eventoRef = doc(db, "events", eventId);

  try {
    const evento = window.allEventsData.find((e) => e.id === eventId);
    const staffExistente = evento.mensajesEnviados || [];

    const staffFinal = [...staffExistente];

    nuevosAsignados.forEach((nuevo) => {
      if (!staffFinal.find((s) => normalizarNombreStaff(s) === nuevo.nombre)) {
        staffFinal.push(nuevo);
      }
    });
    const totalStaffNecesario = Number(evento.staffNecesario || 0);
    const totalStaffAsignado = staffFinal.filter(
      (s) => obtenerEstadoStaff(s) !== "rechazado"
    ).length;
    const staffCompleto =
      totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario;
    await updateDoc(eventoRef, { mensajesEnviados: staffFinal });

    evento.mensajesEnviados = staffFinal;

    if (panel) panel.style.display = "none";
    if (boton) {
      boton.innerText = staffCompleto ? "Completo" : "+ Agregar";
      boton.disabled = staffCompleto;

      if (staffCompleto) {
        boton.classList.add("completo");
      } else {
        boton.classList.remove("completo");
      }
    }
    if (listaStaff) listaStaff.classList.remove("staff-disabled");
    if (btnCerrarModal) btnCerrarModal.style.display = "inline-flex";

    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error asignando staff:", e);
  }
}

// ===============================
// ACCIONES SOBRE STAFF DEL EVENTO
// ===============================
window.quitarStaff = async function (eventId, nombreMozo) {
  if (!confirm(`¿Estás seguro de quitar a ${nombreMozo} del evento?`)) return;

  const eventoRef = doc(db, "events", eventId);
  const evento = window.allEventsData.find((e) => e.id === eventId);

  if (!evento) return;

  try {
    const nuevoStaff = (evento.mensajesEnviados || []).filter(
      (m) => normalizarNombreStaff(m) !== nombreMozo
    );

    await updateDoc(eventoRef, { mensajesEnviados: nuevoStaff });

    evento.mensajesEnviados = nuevoStaff;
    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error al quitar al staff:", e);
    alert("No se pudo quitar al mozo. Intenta de nuevo.");
  }
};

window.enviarWhatsApp = async function (eventId, nombreMozo) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento) return;

  const mozo = (evento.mensajesEnviados || []).find(
    (m) => normalizarNombreStaff(m) === nombreMozo
  );

  if (!mozo) return;

  const telefono = obtenerTelefonoStaff(mozo);
  if (!telefono) {
    alert("Este staff no tiene teléfono cargado.");
    return;
  }

  const fechaEvento = new Date(evento.date + "T00:00:00")
    .toLocaleDateString("es-AR");

  const mensaje =
    `Hola ${normalizarNombreStaff(mozo)}!

  Te escribo de JOOLI para consultarte si podés trabajar en el siguiente evento:

  📅 Fecha: ${fechaEvento}
  📍 Lugar: ${evento.place || "-"}

  🕒 Presentación: ${evento.horaPresentacion || "-"}
  🏁 Fin estimado: ${evento.horaFin || "-"}

  ¿Estás disponible?

  Por favor respondé:
  ✅ CONFIRMO
  ❌ NO PUEDO

  ¡Gracias!`;

  const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");

  if (typeof mozo === "object") {
    mozo.whatsappEnviado = true;
  }

  const eventoRef = doc(db, "events", eventId);

  try {
    await updateDoc(eventoRef, {
      mensajesEnviados: evento.mensajesEnviados,
    });

    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error actualizando envío de WhatsApp:", e);
  }
};


window.rotarEstado = async function (eventId, mozoNombre) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento || !evento.mensajesEnviados) return;

  const mozoIndex = evento.mensajesEnviados.findIndex(
    (m) => normalizarNombreStaff(m) === mozoNombre
  );

  if (mozoIndex === -1) return;

  let mozo = evento.mensajesEnviados[mozoIndex];

  if (typeof mozo === "string") {
    mozo = {
      nombre: mozo,
      estado: "pendiente",
      whatsappEnviado: false,
    };
  }

  const estados = ["pendiente", "confirmado", "rechazado"];
  const currentIndex = estados.indexOf(mozo.estado || "pendiente");
  mozo.estado = estados[(currentIndex + 1) % estados.length];

  const nuevoArray = [...evento.mensajesEnviados];
  nuevoArray[mozoIndex] = mozo;

  try {
    await updateDoc(doc(db, "events", eventId), {
      mensajesEnviados: nuevoArray,
    });

    evento.mensajesEnviados = nuevoArray;
    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error al actualizar estado:", e);
  }
};

// ===============================
// INIT
// ===============================
export function initStaff() {
  if (staffInitDone) return;
  staffInitDone = true;

  document
    .getElementById("btnAbrirSeleccion")
    ?.addEventListener("click", togglePanelSeleccionStaff);

  document
    .getElementById("btnConfirmarAsignacion")
    ?.addEventListener("click", confirmarAsignacionStaff);
}

// ===============================
// EXPONER FUNCIONES
// ===============================
window.guardarMozo = guardarMozo;

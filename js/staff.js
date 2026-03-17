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
// AVISO MODAL
// ===============================
window.mostrarAvisoStaff = function (titulo, mensaje, icono = "⚠️", mostrarBoton = true) {
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
    btnEntendido.style.display = mostrarBoton ? "inline-block" : "none";
  }

  modal.style.display = "flex";
};

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
    window.mostrarAvisoStaff("Faltan datos", "Completá el nombre y el teléfono.", "⚠️");
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
  window.mostrarAvisoStaff(
    "¿Eliminar mozo?",
    "¿Seguro que querés eliminarlo del staff?<br><br>" +
    `<button onclick="window.confirmarBorrarMozo('${id}')" style="` +
    "padding:10px 20px; background:#c0392b; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600; margin-right:8px;" +
    `">Sí, eliminar</button>` +
    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'" style="` +
    "padding:10px 20px; background:#95a5a6; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600;" +
    `">Cancelar</button>`,
    "🗑",
    false
  );
};

window.confirmarBorrarMozo = async function (id) {
  document.getElementById("modalAvisoSimple").style.display = "none";
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
    const inicial = mozo.nombre ? mozo.nombre.charAt(0).toUpperCase() : "?";

    html += `
      <div style="
        display:flex;
        align-items:center;
        padding:10px 12px;
        border-radius:10px;
        margin-bottom:6px;
        background:#f9f7f2;
      ">
        <div style="
          width:36px; height:36px; border-radius:50%;
          background:#111; color:#d4af37;
          display:flex; align-items:center; justify-content:center;
          font-weight:700; font-size:14px; flex-shrink:0;
        ">${inicial}</div>

        <div style="flex:1; margin-left:10px;">
          <div style="font-size:14px; font-weight:600; color:#111;">${escapeHtml(mozo.nombre)}</div>
          <div style="font-size:12px; color:#888; margin-top:1px;">${escapeHtml(mozo.telefono)}</div>
        </div>

        <button
          onclick="borrarMozo('${docSnap.id}')"
          style="
            background:none; border:none; cursor:pointer;
            color:#ccc; font-size:16px; padding:4px 6px;
            border-radius:6px;
          "
          onmouseover="this.style.color='#e74c3c'; this.style.background='#fdecea';"
          onmouseout="this.style.color='#ccc'; this.style.background='none';"
        >🗑</button>
      </div>
    `;
  });

  listaDiv.innerHTML = html || "<p style='text-align:center; color:#888; font-size:14px;'>No hay staff cargado.</p>";
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
    window.mostrarAvisoStaff("Atención", "Primero presioná 'Actualizar evento' para guardar los cambios antes de gestionar el staff.", "⚠️");
    return;
  }

  const inputHoraPresentacion = document.getElementById("horaPresentacionEvento");

  if (inputHoraPresentacion) {
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

  let colorEstado = "#27ae60";
  if (activos === 0) {
    colorEstado = "#c0392b";
  } else if (faltan > 0) {
    colorEstado = "#f39c12";
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
        const inicial = nombre ? nombre.charAt(0).toUpperCase() : "?";

        const avatarColors = {
          confirmado: "background:#27ae60; color:white;",
          rechazado: "background:#e74c3c; color:white;",
          pendiente: "background:#111; color:#d4af37;",
        };

        const avatarStyle = avatarColors[estado] || avatarColors.pendiente;

        const estadoTexto = {
          confirmado: "Confirmado",
          rechazado: "Rechazado",
          pendiente: "Pendiente",
        };

        const estadoColor = {
          confirmado: "#27ae60",
          rechazado: "#e74c3c",
          pendiente: "#888",
        };

        return `
          <div style="
            display:flex; align-items:center;
            padding:10px 12px; border-radius:10px;
            margin-bottom:6px; background:#f9f7f2;
            opacity:${seleccionAbierta ? "0.5" : "1"};
            pointer-events:${seleccionAbierta ? "none" : "auto"};
          ">
            <button
              onclick="window.rotarEstado('${eventId}','${nombre}')"
              title="Cambiar estado"
              style="
                width:36px; height:36px; border-radius:50%;
                ${avatarStyle}
                border:none; cursor:pointer;
                font-weight:700; font-size:14px; flex-shrink:0;
                display:flex; align-items:center; justify-content:center;
              "
            >${inicial}</button>

            <div style="flex:1; margin-left:10px;">
              <div style="font-size:14px; font-weight:600; color:#111;">${escapeHtml(nombre)}</div>
              <div style="font-size:11px; font-weight:600; color:${estadoColor[estado] || "#888"}; margin-top:1px;">
                ${estadoTexto[estado] || "Pendiente"}
              </div>
            </div>

            <button
              onclick="window.enviarWhatsApp('${eventId}','${nombre}')"
              title="Enviar WhatsApp"
              style="
                background:none; border:none; cursor:pointer;
                padding:4px 6px; border-radius:6px; margin-right:4px;
              "
            >
              ${whatsappEnviado
            ? '<i class="fa-solid fa-check" style="color:#27ae60; font-size:16px;"></i>'
            : '<i class="fa-brands fa-whatsapp" style="color:#25D366; font-size:20px;"></i>'
          }
            </button>

            <button
              onclick="window.quitarStaff('${eventId}','${nombre}')"
              title="Quitar"
              style="
                background:none; border:none; cursor:pointer;
                color:#ccc; font-size:16px; padding:4px 6px; border-radius:6px;
              "
              onmouseover="this.style.color='#e74c3c'; this.style.background='#fdecea';"
              onmouseout="this.style.color='#ccc'; this.style.background='none';"
            >🗑</button>
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
    window.mostrarAvisoStaff("Staff completo", "El staff de este evento ya está completo.", "✅");
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
    window.mostrarAvisoStaff("Sin disponibles", "Todos los mozos ya fueron asignados a este evento.", "ℹ️");
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
            gap:12px;
            padding:10px 12px;
            border-radius:10px;
            margin-bottom:6px;
            background:#f9f7f2;
            cursor:pointer;
          ">
            <div style="
              width:36px; height:36px; border-radius:50%;
              background:#111; color:#d4af37;
              display:flex; align-items:center; justify-content:center;
              font-weight:700; font-size:14px; flex-shrink:0;
            ">${escapeHtml(data.nombre.charAt(0).toUpperCase())}</div>

            <span style="flex:1; font-size:14px; font-weight:600; color:#111;">
              ${escapeHtml(data.nombre)}
            </span>

            <input
              type="checkbox"
              class="check-staff-asignar"
              data-nombre="${escapeHtml(data.nombre)}"
              data-tel="${escapeHtml(data.telefono)}"
              style="width:18px; height:18px; cursor:pointer; flex-shrink:0; accent-color:#d4af37;"
            >
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
    window.mostrarAvisoStaff("Atención", "Seleccioná al menos un mozo.", "⚠️");
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
  window.mostrarAvisoStaff(
    "¿Quitar del evento?",
    `¿Seguro que querés quitar a <strong>${nombreMozo}</strong> de este evento?<br><br>` +
    `<button onclick="window.confirmarQuitarStaff('${eventId}','${nombreMozo}')" style="` +
    "padding:10px 20px; background:#c0392b; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600; margin-right:8px;" +
    `">Sí, quitar</button>` +
    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'" style="` +
    "padding:10px 20px; background:#95a5a6; color:white; border:none; " +
    "border-radius:8px; cursor:pointer; font-weight:600;" +
    `">Cancelar</button>`,
    "⚠️",
    false
  );
};

window.confirmarQuitarStaff = async function (eventId, nombreMozo) {
  document.getElementById("modalAvisoSimple").style.display = "none";

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
    window.mostrarAvisoStaff("Error", "No se pudo quitar al mozo. Intentá de nuevo.", "❌");
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
    window.mostrarAvisoStaff("Sin teléfono", "Este staff no tiene teléfono cargado.", "⚠️");
    return;
  }

  const fechaEvento = new Date(evento.date + "T00:00:00")
    .toLocaleDateString("es-AR");

  const mensaje =
    `Hola ${normalizarNombreStaff(mozo)}!

Te contactamos de JOOLI Catering para consultarte si podés trabajar en el siguiente evento:

📅 Fecha: ${fechaEvento}
🍽 Tipo: ${evento.type || "-"}
📍 Lugar: ${evento.place || "-"}${evento.placeUrl ? `\n${evento.placeUrl}` : ""}
👥 Invitados: ${evento.guests || "-"} personas

🕒 Presentación: ${evento.horaPresentacion || "-"}
🏁 Fin: ${evento.horaFin || "-"}

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

window.cargarListaStaffSeccion = function () {
  const listaDiv = document.getElementById("listaStaff");
  if (!listaDiv) return;

  if (unsubscribeListaStaff) unsubscribeListaStaff();

  const q = query(collection(db, "staff"), orderBy("nombre", "asc"));

  unsubscribeListaStaff = onSnapshot(q, (snapshot) => {
    staffCache = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    renderStaffList(snapshot);
  });
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
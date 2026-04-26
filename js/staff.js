import { db } from "./auth.js";
import { pushModalHistory, popModalHistory } from "./ui.js";
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

function formatearDNI(dni) {
  const limpio = String(dni).replace(/\D/g, "");
  if (limpio.length === 7) return limpio.replace(/(\d{1})(\d{3})(\d{3})/, "$1.$2.$3");
  if (limpio.length === 8) return limpio.replace(/(\d{2})(\d{3})(\d{3})/, "$1.$2.$3");
  return dni;
}

function ordenarStaff(lista) {
  return [...lista].sort((a, b) => {
    const nombreA = normalizarNombreStaff(a).toLowerCase();
    const nombreB = normalizarNombreStaff(b).toLowerCase();
    return nombreA.localeCompare(nombreB, "es");
  });
}

// Helper para obtener la fuente de staff (evento o jornada)
function getStaffSource(evento) {
  const modal = document.getElementById("modalGestionStaff");
  const jornadaIdx = modal?.dataset.jornadaIdx !== undefined && modal?.dataset.jornadaIdx !== ""
    ? Number(modal.dataset.jornadaIdx)
    : null;
  const esJornada = window._modoStaffJornada === true && jornadaIdx !== null;

  if (esJornada && evento.jornadas?.[jornadaIdx]) {
    return { source: evento.jornadas[jornadaIdx], esJornada: true, jornadaIdx };
  }
  return { source: evento, esJornada: false, jornadaIdx: null };
}

// ===============================
// STAFF GENERAL (ABM)
// ===============================
export async function guardarMozo() {
  const nombreInput = document.getElementById("mozoNombre");
  const telefonoInput = document.getElementById("mozoTelefono");

  if (!nombreInput || !telefonoInput) return;

  const dniInput = document.getElementById("mozoDni");
  const categoriaInput = document.getElementById("mozoCategoria");

  const nombre = nombreInput.value.trim();
  const telefono = telefonoInput.value.trim();
  const dni = dniInput?.value.trim() || "";
  const categoria = categoriaInput?.value || "Mozo";

  if (!nombre || !telefono) {
    window.mostrarAvisoStaff("Faltan datos", "Completá el nombre y el teléfono.", "⚠️");
    return;
  }

  try {
    await addDoc(collection(db, "staff"), {
      nombre, telefono, dni, categoria,
      createdAt: new Date(),
    });
    nombreInput.value = "";
    telefonoInput.value = "";
    if (dniInput) dniInput.value = "";
  } catch (e) {
    console.error("Error guardando staff:", e);
  }
}

window.borrarMozo = async function (id) {
  window.mostrarAvisoStaff(
    "¿Eliminar mozo?",
    `¿Seguro que querés eliminarlo del staff?<br><br>
    <button onclick="window.confirmarBorrarMozo('${id}')" class="btn-aviso-confirmar">Sí, eliminar</button>
    <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "🗑", false
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
      <div class="staff-list-item">
        <div class="staff-avatar staff-avatar--pendiente">${inicial}</div>
        <div class="staff-list-info">
          <div class="staff-list-nombre">${escapeHtml(mozo.nombre)}</div>
          <div class="staff-list-telefono">${escapeHtml(mozo.telefono)}${mozo.dni ? ` · DNI ${escapeHtml(formatearDNI(mozo.dni))}` : ""}</div>
          <div class="staff-list-categoria">${escapeHtml(mozo.categoria || "Mozo")}</div>
        </div>
        <button onclick="window.verEventosMozo('${escapeHtml(mozo.nombre)}')" class="btn-staff-eventos">📅</button>
        <button onclick="window.editarMozo('${docSnap.id}','${escapeHtml(mozo.nombre)}','${escapeHtml(mozo.telefono)}','${escapeHtml(mozo.dni || "")}','${escapeHtml(mozo.categoria || "Mozo")}')" class="btn-staff-editar">✏️</button>
        <button onclick="borrarMozo('${docSnap.id}')" class="btn-catalogo-eliminar">🗑</button>
      </div>
    `;
  });

  listaDiv.innerHTML = html || "<p class='staff-sin-datos'>No hay staff cargado.</p>";
}

window.verEventosMozo = function (nombreMozo) {
  const hoy = new Date().toLocaleDateString("sv").split("T")[0];

  const eventos = (window.allEventsData || []).filter(e => {
    if (e.status === "Cancelado") return false;

    if (e.esMultidia && e.jornadas?.length > 0) {
      return e.jornadas.some(j =>
        (j.mensajesEnviados || []).some(m => normalizarNombreStaff(m) === nombreMozo)
      );
    }
    return (e.mensajesEnviados || []).some(m => normalizarNombreStaff(m) === nombreMozo);
  });

  const proximos = eventos.filter(e => (e.date || "") >= hoy);
  const pasados = eventos.filter(e => (e.date || "") < hoy);

  if (eventos.length === 0) {
    window.mostrarAvisoStaff(
      `📅 ${nombreMozo}`,
      "No tiene eventos asignados.",
      "🤵"
    );
    return;
  }

  const renderEvento = (e) => {
    if (e.esMultidia && e.jornadas?.length > 0) {
      return e.jornadas
        .filter(j => (j.mensajesEnviados || []).some(m => normalizarNombreStaff(m) === nombreMozo))
        .map(j => {
          const fecha = j.fecha ? new Date(j.fecha + "T00:00:00").toLocaleDateString("es-AR") : "-";
          const estado = (j.mensajesEnviados || []).find(m => normalizarNombreStaff(m) === nombreMozo);
          const color = estado?.estado === "confirmado" ? "#27ae60" : estado?.estado === "rechazado" ? "#c0392b" : "#e67e22";
          return `<div class="mozo-evento-item">
            <div class="mozo-evento-fecha">${fecha}</div>
            <div class="mozo-evento-info">
              <strong>${e.client}</strong> · ${j.tipo || e.type || "-"}<br>
              <small>${j.lugar || "-"}</small>
            </div>
            <span class="mozo-evento-estado" style="color:${color};">${estado?.estado || "pendiente"}</span>
          </div>`;
        }).join("");
    }

    const fecha = e.date ? new Date(e.date + "T00:00:00").toLocaleDateString("es-AR") : "-";
    const estado = (e.mensajesEnviados || []).find(m => normalizarNombreStaff(m) === nombreMozo);
    const color = estado?.estado === "confirmado" ? "#27ae60" : estado?.estado === "rechazado" ? "#c0392b" : "#e67e22";
    return `<div class="mozo-evento-item">
      <div class="mozo-evento-fecha">${fecha}</div>
      <div class="mozo-evento-info">
        <strong>${e.client}</strong> · ${e.type || "-"}<br>
        <small>${e.place || "-"}</small>
      </div>
      <span class="mozo-evento-estado" style="color:${color};">${estado?.estado || "pendiente"}</span>
    </div>`;
  };

  let contenido = "";

  if (proximos.length > 0) {
    contenido += `<div class="mozo-eventos-seccion">📅 Próximos</div>`;
    contenido += proximos.map(renderEvento).join("");
  }

  if (pasados.length > 0) {
    contenido += `<div class="mozo-eventos-seccion" style="margin-top:12px;">📜 Historial</div>`;
    contenido += pasados.slice(-5).reverse().map(renderEvento).join("");
  }

  window.mostrarAvisoStaff(
    `🤵 ${nombreMozo}`,
    `<div style="max-height:350px; overflow-y:auto;">${contenido}</div>`,
    "📅"
  );
};

window.editarMozo = function (id, nombre, telefono, dni, categoria) {
  const nombreInput = document.getElementById("mozoNombre");
  const telefonoInput = document.getElementById("mozoTelefono");
  const dniInput = document.getElementById("mozoDni");
  const categoriaInput = document.getElementById("mozoCategoria");
  const btnAgregar = document.querySelector(".btn-staff-agregar");

  if (nombreInput) nombreInput.value = nombre;
  if (telefonoInput) telefonoInput.value = telefono;
  if (dniInput) dniInput.value = dni;
  if (categoriaInput) categoriaInput.value = categoria;

  if (btnAgregar) {
    btnAgregar.textContent = "Guardar";
    btnAgregar.onclick = () => window.guardarEdicionMozo(id);
  }

  let btnCancelar = document.getElementById("btnCancelarEdicionStaff");
  if (!btnCancelar) {
    btnCancelar = document.createElement("button");
    btnCancelar.id = "btnCancelarEdicionStaff";
    btnCancelar.className = "btn-staff-cancelar";
    btnCancelar.textContent = "Cancelar";
    btnAgregar.insertAdjacentElement("afterend", btnCancelar);
  }
  btnCancelar.style.display = "inline-block";
  btnCancelar.onclick = () => window.resetFormStaff();

  document.getElementById("mozoNombre")?.scrollIntoView({ behavior: "smooth" });
};

window.guardarEdicionMozo = async function (id) {
  const nombre = document.getElementById("mozoNombre")?.value.trim();
  const telefono = document.getElementById("mozoTelefono")?.value.trim();
  const dni = document.getElementById("mozoDni")?.value.trim() || "";
  const categoria = document.getElementById("mozoCategoria")?.value || "Mozo";

  if (!nombre || !telefono) {
    window.mostrarAvisoStaff("Faltan datos", "Completá el nombre y el teléfono.", "⚠️");
    return;
  }

  try {
    await updateDoc(doc(db, "staff", id), { nombre, telefono, dni, categoria });
    window.resetFormStaff();
  } catch (e) {
    console.error("Error actualizando staff:", e);
    window.mostrarAvisoStaff("Error", "No se pudo actualizar. Intentá de nuevo.", "❌");
  }
};

window.resetFormStaff = function () {
  const nombreInput = document.getElementById("mozoNombre");
  const telefonoInput = document.getElementById("mozoTelefono");
  const dniInput = document.getElementById("mozoDni");
  const btnAgregar = document.querySelector(".btn-staff-agregar");

  if (nombreInput) nombreInput.value = "";
  if (telefonoInput) telefonoInput.value = "";
  if (dniInput) dniInput.value = "";

  if (btnAgregar) {
    btnAgregar.textContent = "+ Agregar";
    btnAgregar.onclick = () => guardarMozo();
  }

  const btnCancelar = document.getElementById("btnCancelarEdicionStaff");
  if (btnCancelar) btnCancelar.style.display = "none";
};

export function cargarListaStaff() {
  const listaDiv = document.getElementById("listaStaff");
  if (!listaDiv) return;

  if (unsubscribeListaStaff) unsubscribeListaStaff();

  const q = query(collection(db, "staff"), orderBy("nombre", "asc"));

  unsubscribeListaStaff = onSnapshot(q, (snapshot) => {
    staffCache = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
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
      staffData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      staffCache = staffData;
    }

    container.innerHTML = "";

    if (staffData.length === 0) {
      container.innerHTML = "<small class='staff-sin-datos'>No hay staff cargado</small>";
      return;
    }

    container.innerHTML = staffData.map(data => `
      <label class="staff-checkbox-label">
        <input type="checkbox" name="staffSelected" value="${data.id}"
          data-nombre="${escapeHtml(data.nombre)}"
          data-tel="${escapeHtml(data.telefono)}"
          class="staff-checkbox-input">
        ${escapeHtml(data.nombre)}
      </label>
    `).join("");
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

  // Reset del panel de selección
  const panelReset = document.getElementById("contenedorSeleccionStaff");
  const botonReset = document.getElementById("btnAbrirSeleccion");
  const listaReset = document.getElementById("listaGestionStaffContenido");
  const btnCerrarReset = document.getElementById("btnCerrarModalStaff");

  if (panelReset) panelReset.style.display = "none";
  if (listaReset) listaReset.classList.remove("staff-disabled");
  if (btnCerrarReset) btnCerrarReset.style.display = "inline-flex";
  if (botonReset) {
    botonReset.innerText = "+ Agregar";
    botonReset.disabled = false;
    botonReset.classList.remove("completo");
  }

  // Determinar si operamos sobre una jornada o el evento
  const { source: staffSource, esJornada, jornadaIdx } = getStaffSource(evento);

  const modal = document.getElementById("modalGestionStaff");
  const container = document.getElementById("listaGestionStaffContenido");
  const titulo = document.getElementById("tituloModalStaff");
  const resumen = document.getElementById("resumenStaffEvento");

  if (!modal || !container || !titulo) return;

  modal.dataset.eventId = eventId;

  const today = new Date().toLocaleDateString("sv").split("T")[0];
  const fechaRef = esJornada ? (staffSource.fecha || evento.date) : evento.date;
  const soloLectura = fechaRef < today;

  // Hora de presentación — solo para evento completo
  const inputHoraPresentacion = document.getElementById("horaPresentacionEvento");
  if (inputHoraPresentacion) {
    if (!esJornada) {
      if (!evento.horaPresentacion && evento.horaInicio) {
        const [h, m] = evento.horaInicio.split(":").map(Number);
        const totalMin = h * 60 + m - 120;
        const minDia = 24 * 60;
        const ajustado = (totalMin + minDia) % minDia;
        const hh = String(Math.floor(ajustado / 60)).padStart(2, "0");
        const mm = String(ajustado % 60).padStart(2, "0");
        const horaCalculada = `${hh}:${mm}`;
        try {
          await updateDoc(doc(db, "events", eventId), { horaPresentacion: horaCalculada });
          evento.horaPresentacion = horaCalculada;
        } catch (e) {
          console.error("Error guardando hora de presentación:", e);
        }
      }
      inputHoraPresentacion.value = evento.horaPresentacion || "";
      inputHoraPresentacion.disabled = soloLectura;
      inputHoraPresentacion.onchange = async function () {
        try {
          await updateDoc(doc(db, "events", eventId), { horaPresentacion: this.value });
          evento.horaPresentacion = this.value;
        } catch (e) {
          console.error("Error guardando hora de presentación:", e);
        }
      };
    } else {
      inputHoraPresentacion.value = staffSource.horaPresentacion || "";
      inputHoraPresentacion.disabled = soloLectura;
      inputHoraPresentacion.onchange = async function () {
        staffSource.horaPresentacion = this.value;
        if (window._jornadasActuales?.[jornadaIdx]) {
          window._jornadasActuales[jornadaIdx].horaPresentacion = this.value;
        }
        try {
          await updateDoc(doc(db, "events", eventId), { jornadas: evento.jornadas });
        } catch (e) {
          console.error("Error guardando hora de presentación de jornada:", e);
        }
      };
    }
  }

  const inputLugarPresentacion = document.getElementById("lugarPresentacionEvento");
  if (inputLugarPresentacion) {
    const lugarRef = esJornada ? staffSource : evento;
    inputLugarPresentacion.value = lugarRef.lugarPresentacion || "";
    inputLugarPresentacion.disabled = soloLectura;
    inputLugarPresentacion.onchange = async function () {
      lugarRef.lugarPresentacion = this.value;
      try {
        if (esJornada) {
          if (window._jornadasActuales?.[jornadaIdx]) {
            window._jornadasActuales[jornadaIdx].lugarPresentacion = this.value;
          }
          await updateDoc(doc(db, "events", eventId), { jornadas: evento.jornadas });
        } else {
          await updateDoc(doc(db, "events", eventId), { lugarPresentacion: this.value });
        }
      } catch (e) {
        console.error("Error guardando lugar de presentación:", e);
      }
    };
  }

  // Título del modal
  if (esJornada) {
    const fechaJornada = staffSource.fecha
      ? new Date(staffSource.fecha + "T00:00:00").toLocaleDateString("es-AR")
      : `Jornada ${jornadaIdx + 1}`;
    titulo.innerText = `📅 ${fechaJornada} · ${evento.client}`;
  } else {
    const fechaEvento = evento.date
      ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
      : "";
    titulo.innerText = `📅 ${fechaEvento} · ${evento.client}`;
  }

  const mensajes = ordenarStaff(staffSource.mensajesEnviados || []);
  const panelSeleccion = document.getElementById("contenedorSeleccionStaff");
  const seleccionAbierta = panelSeleccion && panelSeleccion.style.display !== "none";
  const totalStaffNecesario = esJornada ? Number(staffSource.staffNecesario || 0) : Number(evento.staffNecesario || 0);
  const totalStaffAsignado = mensajes.filter(m => obtenerEstadoStaff(m) !== "rechazado").length;
  const staffCompleto = totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario;

  const botonAgregar = document.getElementById("btnAbrirSeleccion");
  if (botonAgregar) {
    if (soloLectura) {
      botonAgregar.style.display = "none";
    } else {
      botonAgregar.style.display = "";
      if (seleccionAbierta) {
        botonAgregar.disabled = false;
        botonAgregar.innerText = "Cancelar";
        botonAgregar.classList.remove("completo");
      } else {
        botonAgregar.disabled = staffCompleto;
        botonAgregar.innerText = staffCompleto ? "Completo" : "+ Agregar";
        botonAgregar.classList.toggle("completo", staffCompleto);
      }
    }
  }

  const confirmados = mensajes.filter(m => obtenerEstadoStaff(m) === "confirmado").length;
  const pendientes = mensajes.filter(m => obtenerEstadoStaff(m) === "pendiente").length;
  const rechazados = mensajes.filter(m => obtenerEstadoStaff(m) === "rechazado").length;
  const staffNecesario = esJornada ? Number(staffSource.staffNecesario || 0) : Number(evento.staffNecesario || 0);
  const activos = confirmados + pendientes;
  const faltan = Math.max(staffNecesario - activos, 0);

  // Botón copiar staff de jornada anterior
  const btnCopiarStaff = document.getElementById("btnCopiarStaffAnterior");
  if (btnCopiarStaff) {
    const jornadaAnterior = esJornada && jornadaIdx > 0 ? evento.jornadas[jornadaIdx - 1] : null;
    const tieneStaffAnterior = jornadaAnterior?.mensajesEnviados?.length > 0;
    if (esJornada && jornadaIdx > 0 && tieneStaffAnterior && !soloLectura) {
      btnCopiarStaff.style.display = "inline-flex";
      btnCopiarStaff.onclick = async function () {
        const staffCopiado = jornadaAnterior.mensajesEnviados.map(m => ({ ...m, estado: "pendiente", whatsappEnviado: false }));
        staffSource.mensajesEnviados = staffCopiado;
        evento.jornadas[jornadaIdx].mensajesEnviados = staffCopiado;
        if (window._jornadasActuales?.[jornadaIdx]) {
          window._jornadasActuales[jornadaIdx].mensajesEnviados = staffCopiado;
        }
        try {
          await updateDoc(doc(db, "events", eventId), { jornadas: evento.jornadas });
          window.abrirModalGestionStaff(eventId);
        } catch (e) {
          console.error("Error copiando staff:", e);
        }
      };
    } else {
      btnCopiarStaff.style.display = "none";
    }
  }

  if (resumen) {
    const linea1 = mensajes.length === 0
      ? "Sin staff asignado"
      : `${confirmados} confirmados · ${pendientes} pendientes${rechazados > 0 ? ` · ${rechazados} rechazados` : ""}`;
    const colorClase = activos === 0 ? "danger" : faltan > 0 ? "warning" : "ok";
    const linea2 = staffNecesario > 0
      ? `<span class="staff-resumen-estado staff-resumen-estado--${colorClase}">🤵 ${staffNecesario} necesarios · ✔ ${activos} · ➕ ${faltan}</span>`
      : "";
    resumen.innerHTML = linea2 ? `${linea1}<br>${linea2}` : linea1;
  }

  if (mensajes.length === 0) {
    container.innerHTML = "<p class='staff-sin-datos'>No hay staff asignado todavía.</p>";
  } else {
    const estadoTexto = { confirmado: "Confirmado", rechazado: "Rechazado", pendiente: "Pendiente" };
    const mozos = mensajes.filter(m => (m.categoria || "Mozo") === "Mozo");
    const cocina = mensajes.filter(m => m.categoria === "Cocina");

    const renderGrupo = (lista, tituloGrupo) => {
      if (lista.length === 0) return "";
      return `
        <div class="staff-grupo-titulo">${tituloGrupo}</div>
        ${lista.map(m => {
        const nombre = normalizarNombreStaff(m);
        const estado = obtenerEstadoStaff(m);
        const whatsappEnviado = obtenerWhatsappEnviado(m);
        const inicial = nombre ? nombre.charAt(0).toUpperCase() : "?";
        return `
            <div class="staff-gestion-item ${seleccionAbierta ? "staff-gestion-item--disabled" : ""}">
              ${soloLectura
            ? `<div title="${estadoTexto[estado] || estado}" class="staff-avatar staff-avatar--${estado}">${inicial}</div>`
            : `<button onclick="window.rotarEstado('${eventId}','${nombre}')" title="Cambiar estado" class="staff-avatar staff-avatar--${estado}">${inicial}</button>`
          }
              <div class="staff-list-info">
                <div class="staff-list-nombre">${escapeHtml(nombre)}</div>
                <div class="staff-estado staff-estado--${estado}">${estadoTexto[estado] || "Pendiente"}</div>
              </div>
              <button
                ${soloLectura ? "disabled style='opacity:0.4; cursor:default;'" : `onclick="window.enviarWhatsApp('${eventId}','${nombre}')"`}
                title="${soloLectura ? "Evento pasado" : "Enviar WhatsApp"}"
                class="btn-icon wa"
              >
                ${whatsappEnviado
            ? '<i class="fa-solid fa-check sent-icon"></i>'
            : '<i class="fa-brands fa-whatsapp"></i>'
          }
              </button>
              ${soloLectura ? "" : `<button onclick="window.quitarStaff('${eventId}','${nombre}')" title="Quitar" class="btn-catalogo-eliminar">🗑</button>`}
            </div>
          `;
      }).join("")}
      `;
    };

    container.innerHTML = renderGrupo(mozos, "🍽 Mozos") + renderGrupo(cocina, "👨‍🍳 Cocina");
  }

  modal.style.display = "flex";
  pushModalHistory(window._cerrarStaffSinPop);
};

function _cerrarStaffBase() {
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
  window._modoStaffJornada = false;
  if (modal) modal.dataset.jornadaIdx = "";
}

// Cierre desde botón ✕ — hace pop manual del stack
window.cerrarModalGestionStaff = function () {
  popModalHistory();
  _cerrarStaffBase();
  // Volver al detalle si venimos de ahí
  if (window._detalleEventoAbierto) {
    window.abrirModalDetalle(window._detalleEventoAbierto);
    window._detalleEventoAbierto = null;
  }
};

// Cierre desde botón atrás del celu — el stack ya fue consumido por popstate
window._cerrarStaffSinPop = function () {
  _cerrarStaffBase();
  if (window._detalleEventoAbierto) {
    const modalDetalle = document.getElementById("modalDetalleEvento");
    if (modalDetalle && modalDetalle.style.display === "flex") {
      modalDetalle.style.visibility = "visible";
      modalDetalle.style.pointerEvents = "auto";
      delete modalDetalle.dataset.ocultoPorChecklist;
    }
  }
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

  const { source: staffSource, esJornada: esJornadaPanel } = getStaffSource(evento);

  const totalStaffNecesario = esJornadaPanel ? Number(staffSource.staffNecesario || 0) : Number(evento.staffNecesario || 0);
  const totalStaffAsignado = (staffSource.mensajesEnviados || []).filter(
    m => obtenerEstadoStaff(m) !== "rechazado"
  ).length;

  if (totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario) {
    window.mostrarAvisoStaff("Staff completo", "El staff de este evento ya está completo.", "✅");
    return;
  }

  const staffYaAsignado = (staffSource.mensajesEnviados || []).map(m => normalizarNombreStaff(m));

  let staffDisponiblesData = staffCache;
  if (staffDisponiblesData.length === 0) {
    const q = query(collection(db, "staff"), orderBy("nombre"));
    const snapshot = await getDocs(q);
    staffDisponiblesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    staffCache = staffDisponiblesData;
  }

  const staffDisponibles = staffDisponiblesData.filter(d => !staffYaAsignado.includes(d.nombre));

  if ((panel.style.display === "none" || panel.style.display === "") && staffDisponibles.length === 0) {
    window.mostrarAvisoStaff("Sin disponibles", "Todos los mozos ya fueron asignados a este evento.", "ℹ️");
    return;
  }

  if (panel.style.display === "none" || panel.style.display === "") {
    let html = "";
    let hayDisponibles = false;

    const disponiblesMozos = staffDisponibles.filter(d => (d.categoria || "Mozo") === "Mozo");
    const disponiblesCocina = staffDisponibles.filter(d => d.categoria === "Cocina");

    const renderGrupoSeleccion = (lista, tituloGrupo) => {
      if (lista.length === 0) return "";
      hayDisponibles = true;
      return `
        <div class="staff-grupo-titulo">${tituloGrupo}</div>
        ${lista.map(data => `
          <label class="staff-seleccion-label">
            <div class="staff-avatar staff-avatar--pendiente">
              ${escapeHtml(data.nombre.charAt(0).toUpperCase())}
            </div>
            <span class="staff-seleccion-nombre">${escapeHtml(data.nombre)}</span>
            <input type="checkbox" class="check-staff-asignar staff-seleccion-check"
              data-nombre="${escapeHtml(data.nombre)}"
              data-tel="${escapeHtml(data.telefono)}"
              data-categoria="${escapeHtml(data.categoria || "Mozo")}">
          </label>
        `).join("")}
      `;
    };

    html += renderGrupoSeleccion(disponiblesMozos, "🍽 Mozos");
    html += renderGrupoSeleccion(disponiblesCocina, "👨‍🍳 Cocina");

    listado.innerHTML = hayDisponibles
      ? html
      : "<p class='staff-sin-datos'>Todos los mozos ya han sido asignados a este evento.</p>";

    panel.style.display = "block";
    boton.innerText = "Cancelar";
    listaStaff.classList.add("staff-disabled");
    if (btnCerrarModal) btnCerrarModal.style.display = "none";
    pushModalHistory(() => {
      panel.style.display = "none";
      boton.innerText = "+ Agregar";
      listaStaff.classList.remove("staff-disabled");
      if (btnCerrarModal) btnCerrarModal.style.display = "inline-flex";
    });
  } else {
    popModalHistory();
    panel.style.display = "none";
    boton.innerText = "+ Agregar";
    listaStaff.classList.remove("staff-disabled");
    if (btnCerrarModal) btnCerrarModal.style.display = "inline-flex";
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
  if (!eventId) return;

  const checks = document.querySelectorAll(".check-staff-asignar:checked");
  if (checks.length === 0) {
    window.mostrarAvisoStaff("Atención", "Seleccioná al menos un mozo.", "⚠️");
    return;
  }

  const nuevosAsignados = Array.from(checks).map(c => ({
    nombre: c.dataset.nombre,
    telefono: c.dataset.tel,
    categoria: c.dataset.categoria || "Mozo",
    estado: "pendiente",
    whatsappEnviado: false,
  }));

  const eventoRef = doc(db, "events", eventId);

  try {
    const evento = window.allEventsData.find(e => e.id === eventId);
    const { source: staffSource, esJornada, jornadaIdx } = getStaffSource(evento);

    const staffExistente = staffSource.mensajesEnviados || [];
    const staffFinal = [...staffExistente];

    nuevosAsignados.forEach(nuevo => {
      if (!staffFinal.find(s => normalizarNombreStaff(s) === nuevo.nombre)) {
        staffFinal.push(nuevo);
      }
    });

    const totalStaffNecesario = esJornada ? Number(staffSource.staffNecesario || 0) : Number(evento.staffNecesario || 0);
    const totalStaffAsignado = staffFinal.filter(s => obtenerEstadoStaff(s) !== "rechazado").length;
    const staffCompleto = totalStaffNecesario > 0 && totalStaffAsignado >= totalStaffNecesario;

    staffSource.mensajesEnviados = staffFinal;

    if (esJornada) {
      if (window._jornadasActuales?.[jornadaIdx]) {
        window._jornadasActuales[jornadaIdx].mensajesEnviados = staffFinal;
      }
      await updateDoc(eventoRef, { jornadas: evento.jornadas });
    } else {
      await updateDoc(eventoRef, { mensajesEnviados: staffFinal });
      evento.mensajesEnviados = staffFinal;
    }

    if (panel) panel.style.display = "none";
    if (boton) {
      boton.innerText = staffCompleto ? "Completo" : "+ Agregar";
      boton.disabled = staffCompleto;
      boton.classList.toggle("completo", staffCompleto);
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
    `¿Seguro que querés quitar a <strong>${nombreMozo}</strong> de este evento?<br><br>
    <button onclick="window.confirmarQuitarStaff('${eventId}','${nombreMozo}')" class="btn-aviso-confirmar">Sí, quitar</button>
    <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "⚠️", false
  );
};

window.confirmarQuitarStaff = async function (eventId, nombreMozo) {
  document.getElementById("modalAvisoSimple").style.display = "none";

  const eventoRef = doc(db, "events", eventId);
  const evento = window.allEventsData.find(e => e.id === eventId);
  if (!evento) return;

  const { source: staffSource, esJornada, jornadaIdx } = getStaffSource(evento);

  try {
    const nuevoStaff = (staffSource.mensajesEnviados || []).filter(
      m => normalizarNombreStaff(m) !== nombreMozo
    );
    staffSource.mensajesEnviados = nuevoStaff;

    if (esJornada) {
      if (window._jornadasActuales?.[jornadaIdx]) {
        window._jornadasActuales[jornadaIdx].mensajesEnviados = nuevoStaff;
      }
      await updateDoc(eventoRef, { jornadas: evento.jornadas });
    } else {
      await updateDoc(eventoRef, { mensajesEnviados: nuevoStaff });
      evento.mensajesEnviados = nuevoStaff;
    }

    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error al quitar al staff:", e);
    window.mostrarAvisoStaff("Error", "No se pudo quitar al mozo. Intentá de nuevo.", "❌");
  }
};

function esMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

window.enviarWhatsApp = async function (eventId, nombreMozo) {
  const evento = window.allEventsData.find(e => e.id === eventId);
  if (!evento) return;

  const { source: staffSource, esJornada } = getStaffSource(evento);

  const mozo = (staffSource.mensajesEnviados || []).find(
    m => normalizarNombreStaff(m) === nombreMozo
  );
  if (!mozo) return;

  const telefono = obtenerTelefonoStaff(mozo);
  if (!telefono) {
    window.mostrarAvisoStaff("Sin teléfono", "Este staff no tiene teléfono cargado.", "⚠️");
    return;
  }

  const fechaRef = esJornada ? (staffSource.fecha || evento.date) : evento.date;
  const fechaEvento = new Date(fechaRef + "T00:00:00").toLocaleDateString("es-AR");
  const lugarRef = esJornada ? (staffSource.lugar || evento.place) : evento.place;
  const tipoRef = esJornada ? (staffSource.tipo || evento.type) : evento.type;
  const horaInicioRef = esJornada ? staffSource.horaInicio : evento.horaInicio;
  const horaFinRef = esJornada ? staffSource.horaFin : evento.horaFin;
  const horaPresentRef = esJornada ? staffSource.horaPresentacion : evento.horaPresentacion;

  const mobile = esMobile();

  const nl = "\n";

  const mensaje = mobile
    ? `Hola ${normalizarNombreStaff(mozo)}!

Te contactamos de JOOLI Catering para consultarte si podés trabajar en el siguiente evento:

📅 Fecha: ${fechaEvento}
🍽 Tipo: ${tipoRef || "-"}
📍 Lugar: ${lugarRef || "-"}${!esJornada && evento.placeUrl ? `\n${evento.placeUrl}` : ""}
👥 Invitados: ${esJornada ? (staffSource.invitados || evento.guests || "-") : (evento.guests || "-")} personas

🕒 Presentación: ${horaPresentRef || "-"}${(() => {
      const lp = esJornada ? staffSource.lugarPresentacion : evento.lugarPresentacion;
      return lp ? `\n📍 *Lugar de presentación: ${lp}*` : "";
    })()}
🏁 Fin: ${horaFinRef || "-"}

¿Estás disponible?

Por favor respondé:
✅ CONFIRMO
❌ NO PUEDO

¡Gracias!`

    : `Hola ${normalizarNombreStaff(mozo)}!

Te contactamos de JOOLI Catering para consultarte si podés trabajar en el siguiente evento:

---------------------------------------
Fecha: ${fechaEvento}
Tipo: ${tipoRef || "-"}
Lugar: ${lugarRef || "-"}${!esJornada && evento.placeUrl ? `\n${evento.placeUrl}` : ""}
Invitados: ${esJornada ? (staffSource.invitados || evento.guests || "-") : (evento.guests || "-")} personas

Presentacion: ${horaPresentRef || "-"}${(() => {
      const lp = esJornada ? staffSource.lugarPresentacion : evento.lugarPresentacion;
      return lp ? `\n*Lugar de presentacion: ${lp}*` : "";
    })()}
Fin: ${horaFinRef || "-"}
---------------------------------------

Estas disponible?

Por favor responde:
- CONFIRMO
- NO PUEDO

Gracias!`;

  window._whatsappPendiente = {
    url: `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`,
    eventId, mozo, evento, esJornada,
  };

  window.mostrarAvisoSimple(
    "📱 Vista previa del mensaje",
    `<div style="background:#f4f1eb; border-radius:8px; padding:12px; font-size:13px; line-height:1.6; white-space:pre-wrap; max-height:300px; overflow-y:auto; text-align:left;">${mensaje.replace(/\n/g, "<br>")}</div><br>
    <button onclick="window.confirmarEnvioWhatsApp()" class="btn-aviso-confirmar">Enviar por WhatsApp</button>
    <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "💬", false
  );
};

window.confirmarEnvioWhatsApp = async function () {
  document.getElementById("modalAvisoSimple").style.display = "none";

  const { url, eventId, mozo, evento, esJornada } = window._whatsappPendiente;
  window.open(url, "_blank");

  if (typeof mozo === "object") mozo.whatsappEnviado = true;

  const eventoRef = doc(db, "events", eventId);

  try {
    if (esJornada) {
      await updateDoc(eventoRef, { jornadas: evento.jornadas });
    } else {
      await updateDoc(eventoRef, { mensajesEnviados: evento.mensajesEnviados });
    }
    window.abrirModalGestionStaff(eventId);
  } catch (e) {
    console.error("Error actualizando envío de WhatsApp:", e);
  }
};

window.rotarEstado = async function (eventId, mozoNombre) {
  const evento = window.allEventsData.find(e => e.id === eventId);
  if (!evento) return;

  const { source: staffSource, esJornada, jornadaIdx } = getStaffSource(evento);

  const mensajesEnviados = staffSource.mensajesEnviados;
  if (!mensajesEnviados) return;

  const mozoIndex = mensajesEnviados.findIndex(m => normalizarNombreStaff(m) === mozoNombre);
  if (mozoIndex === -1) return;

  let mozo = mensajesEnviados[mozoIndex];
  if (typeof mozo === "string") {
    mozo = { nombre: mozo, estado: "pendiente", whatsappEnviado: false };
  }

  const estados = ["pendiente", "confirmado", "rechazado"];
  const currentIndex = estados.indexOf(mozo.estado || "pendiente");
  mozo.estado = estados[(currentIndex + 1) % estados.length];

  const nuevoArray = [...mensajesEnviados];
  nuevoArray[mozoIndex] = mozo;
  staffSource.mensajesEnviados = nuevoArray;

  try {
    const eventoRef = doc(db, "events", eventId);
    if (esJornada) {
      if (window._jornadasActuales?.[jornadaIdx]) {
        window._jornadasActuales[jornadaIdx].mensajesEnviados = nuevoArray;
      }
      await updateDoc(eventoRef, { jornadas: evento.jornadas });
    } else {
      evento.mensajesEnviados = nuevoArray;
      await updateDoc(eventoRef, { mensajesEnviados: nuevoArray });
    }
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
    staffCache = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStaffList(snapshot);
  });
};

window.generarPDFStaff = function () {
  const modal = document.getElementById("modalGestionStaff");
  const eventId = modal?.dataset.eventId;
  const evento = window.allEventsData.find(e => e.id === eventId);
  if (!evento) return;

  const { source: staffSource, esJornada, jornadaIdx } = getStaffSource(evento);
  const mensajes = (staffSource.mensajesEnviados || []).filter(
    m => obtenerEstadoStaff(m) === "confirmado"
  );

  if (mensajes.length === 0) {
    window.mostrarAvisoStaff("Sin confirmados", "No hay staff confirmado para generar la lista ART.", "⚠️");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  // Encabezado
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("JOOLI Catering", 105, 20, { align: "center" });

  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.text("Lista de personal para ART", 105, 28, { align: "center" });

  // Datos del evento
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");

  const fechaEvento = esJornada
    ? (staffSource.fecha ? new Date(staffSource.fecha + "T00:00:00").toLocaleDateString("es-AR") : `Jornada ${jornadaIdx + 1}`)
    : evento.esMultidia && evento.jornadas?.length > 0
      ? evento.jornadas.map(j => j.fecha ? new Date(j.fecha + "T00:00:00").toLocaleDateString("es-AR") : "").filter(Boolean).join(", ")
      : evento.date ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR") : "";

  pdf.text(`${evento.client || ""}`, 105, 38, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Fecha: ${fechaEvento}`, 105, 45, { align: "center" });

  if (!esJornada && evento.place) {
    pdf.text(`Lugar: ${evento.place}`, 105, 51, { align: "center" });
  } else if (esJornada && staffSource.lugar) {
    pdf.text(`Lugar: ${staffSource.lugar}`, 105, 51, { align: "center" });
  }

  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.5);
  pdf.line(14, 57, 196, 57);

  // Encabezado tabla
  let y = 66;
  pdf.setFillColor(240, 236, 227);
  pdf.rect(14, y - 5, 182, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("#", 17, y);
  pdf.text("Apellido y Nombre", 28, y);
  pdf.text("DNI", 140, y);
  pdf.text("Firma", 170, y);

  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.line(14, y + 2, 196, y + 2);

  y += 10;

  // Filas
  mensajes.forEach((m, i) => {
    if (y > 275) { pdf.addPage(); y = 20; }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`${i + 1}`, 17, y);
    pdf.text(normalizarNombreStaff(m), 28, y);

    const dni = typeof m === "object" ? formatearDNI(m.dni || "-") : "-";
    pdf.text(dni, 140, y);

    // Línea para firma
    pdf.setDrawColor(180, 180, 180);
    pdf.line(165, y, 195, y);

    // Línea separadora
    pdf.setDrawColor(230, 230, 230);
    pdf.line(14, y + 3, 196, y + 3);

    y += 12;
  });

  // Total
  y += 4;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(`Total de personal: ${mensajes.length}`, 14, y);

  // Pie
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generado por JOOLI CateringDesk · ${new Date().toLocaleDateString("es-AR")}`, 105, 290, { align: "center" });

  const pdfBlob = pdf.output("blob");
  window.open(URL.createObjectURL(pdfBlob), "_blank");
};
// ===============================
// INIT
// ===============================
export function initStaff() {
  if (staffInitDone) return;
  staffInitDone = true;

  document.getElementById("btnAbrirSeleccion")
    ?.addEventListener("click", togglePanelSeleccionStaff);

  document.getElementById("btnConfirmarAsignacion")
    ?.addEventListener("click", confirmarAsignacionStaff);
}

// ===============================
// EXPONER FUNCIONES
// ===============================
window.guardarMozo = guardarMozo;

window.abrirModalMapsLugarPresentacion = function () {
  const confirmarOriginal = window.confirmarUbicacion;
  window.confirmarUbicacion = function () {
    const place = window._selectedPlace;
    if (!place) {
      window.mostrarAvisoStaff("Sin selección", "Buscá y seleccioná un lugar primero.", "⚠️");
      return;
    }
    const input = document.getElementById("lugarPresentacionEvento");
    if (input) {
      input.value = place.nombre || place.direccion;
      input.dispatchEvent(new Event("change"));
    }
    window.cerrarModalMaps();
    window.confirmarUbicacion = confirmarOriginal;
  };
  window.abrirModalMaps();
};

// ===============================
// GESTIÓN DE PAGOS
// ===============================
export function abrirModalPagos(eventoId) {
  const evento = (window.allEventsData || []).find(e => e.id === eventoId);
  if (!evento) return;

  // Solo staff confirmado
  const confirmados = (evento.mensajesEnviados || [])
    .filter(m => (typeof m === "object" ? m.estado : "pendiente") === "confirmado")
    .sort((a, b) => {
      const nombreA = (typeof a === "object" ? a.nombre : a).toLowerCase();
      const nombreB = (typeof b === "object" ? b.nombre : b).toLowerCase();
      return nombreA.localeCompare(nombreB, "es");
    });

  const pagosGuardados = evento.pagosStaff || {};
  const lista = document.getElementById("pagosLista");
  if (!lista) return;

  lista.innerHTML = confirmados.length === 0
    ? "<p style='color:#aaa; text-align:center; padding:20px;'>No hay staff confirmado en este evento.</p>"
    : confirmados.map(m => {
      const nombre = typeof m === "object" ? m.nombre : m;
      const pago = pagosGuardados[nombre] || { monto: "", pagado: false };
      return `
          <div class="pago-item" id="pago-item-${CSS.escape(nombre)}">
            <input type="checkbox" id="pagado-${CSS.escape(nombre)}"
              ${pago.pagado ? "checked" : ""}
              onchange="window.actualizarEstiloPago('${nombre}'); window.recalcularTotalPagos()">
            <span class="pago-item-nombre ${pago.pagado ? "pago-item-nombre--pagado" : ""}"
              id="pago-nombre-${CSS.escape(nombre)}">${nombre}</span>
            <input type="number" min="0" placeholder="$0"
              id="monto-${CSS.escape(nombre)}"
              value="${pago.monto || ""}"
              oninput="window.recalcularTotalPagos()">
          </div>`;
    }).join("");

  recalcularTotalPagos();

  document.getElementById("pagoMontoFijo").value = "";
  document.getElementById("modalPagosStaff").dataset.eventoId = eventoId;
  document.getElementById("modalPagosStaff").style.display = "flex";
}

window.cerrarModalPagos = function () {
  document.getElementById("modalPagosStaff").style.display = "none";
};

window.actualizarEstiloPago = function (nombre) {
  const cb = document.getElementById(`pagado-${CSS.escape(nombre)}`);
  const nombreEl = document.getElementById(`pago-nombre-${CSS.escape(nombre)}`);
  if (cb && nombreEl) {
    nombreEl.classList.toggle("pago-item-nombre--pagado", cb.checked);
  }
};

window.aplicarMontoFijo = function () {
  const monto = document.getElementById("pagoMontoFijo")?.value;
  if (!monto) return;
  document.querySelectorAll(".pago-item input[type='number']").forEach(input => {
    input.value = monto;
  });
  recalcularTotalPagos();
};

function recalcularTotalPagos() {
  const items = document.querySelectorAll(".pago-item");
  let totalPagado = 0;
  let totalGeneral = 0;

  items.forEach(item => {
    const checkbox = item.querySelector("input[type='checkbox']");
    const monto = Number(item.querySelector("input[type='number']")?.value) || 0;
    totalGeneral += monto;
    if (checkbox?.checked) totalPagado += monto;
  });

  const totalEl = document.getElementById("pagosTotal");
  if (totalEl) totalEl.textContent = `Total: $${totalGeneral.toLocaleString("es-AR")}`;

  const caja = Number(document.getElementById("pagosCajaChica")?.value) || 0;
  const saldoEl = document.getElementById("pagosSaldo");
  if (saldoEl) {
    if (caja === 0) {
      saldoEl.textContent = "-";
      saldoEl.className = "pagos-saldo";
    } else {
      const saldo = caja - totalPagado;
      saldoEl.textContent = `$${saldo.toLocaleString("es-AR")}`;
      saldoEl.className = "pagos-saldo " + (saldo >= 0 ? "pagos-saldo--ok" : "pagos-saldo--negativo");
    }
  }
}

window.recalcularTotalPagos = recalcularTotalPagos;

window.guardarPagos = async function () {
  const eventoId = document.getElementById("modalPagosStaff")?.dataset.eventoId;
  if (!eventoId) return;

  const evento = (window.allEventsData || []).find(e => e.id === eventoId);
  if (!evento) return;

  const confirmados = (evento.mensajesEnviados || []).filter(
    m => (typeof m === "object" ? m.estado : "pendiente") === "confirmado"
  );

  const pagosStaff = {};
  confirmados.forEach(m => {
    const nombre = typeof m === "object" ? m.nombre : m;
    const monto = Number(document.getElementById(`monto-${CSS.escape(nombre)}`)?.value) || 0;
    const pagado = document.getElementById(`pagado-${CSS.escape(nombre)}`)?.checked || false;
    pagosStaff[nombre] = { monto, pagado };
  });

  try {
    const { db } = await import("./auth.js");
    const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
    await updateDoc(doc(db, "events", eventoId), { pagosStaff });

    evento.pagosStaff = pagosStaff;

    window.mostrarAvisoSimple("Pagos guardados", "Los pagos se registraron correctamente.", "✅");
    window.cerrarModalPagos();
  } catch (e) {
    window.mostrarAvisoSimple("Error", "No se pudieron guardar los pagos.", "❌");
  }
};

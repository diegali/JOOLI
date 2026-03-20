import { db } from "./auth.js";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let catalogoBase = [];
let pestanaActiva = "checklist"; // "checklist" | "catalogo"

// ===============================
// INIT
// ===============================
export function initLista() {
  cargarCatalogo();
}

function cargarCatalogo() {
  const q = query(
    collection(db, "catalogoChecklist"),
    orderBy("categoria"),
    orderBy("nombre")
  );
  onSnapshot(q, (snap) => {
    catalogoBase = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Si el modal está abierto, refrescar la pestaña activa
    const modal = document.getElementById("modalChecklist");
    if (modal && modal.style.display === "flex") {
      if (pestanaActiva === "catalogo") {
        renderPestanaCatalogo();
      } else {
        renderPestanaChecklist();
      }
    }
  });
}

// ===============================
// ABRIR / CERRAR MODAL
// ===============================
window.abrirModalChecklist = function (eventId) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento) return;

  if (!evento.checklist) evento.checklist = [];
  window.eventoChecklistActual = evento;

  const today = new Date().toISOString().split("T")[0];
  window.checklistSoloLectura = evento.date < today;

  pestanaActiva = "checklist";

  const titulo = document.getElementById("tituloModalChecklist");
  if (titulo) {
    const fecha = evento.date
      ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
      : "";
    titulo.innerText = `📦 ${fecha} · ${evento.client}`;
  }

  actualizarPestanas();
  document.getElementById("modalChecklist").style.display = "flex";
};

window.cerrarModalChecklist = function () {
  const modal = document.getElementById("modalChecklist");
  if (modal) modal.style.display = "none";
  if (window._detalleEventoAbierto) {
    window.abrirModalDetalle(window._detalleEventoAbierto);
    window._detalleEventoAbierto = null;
  }
  window.eventoChecklistActual = null;
};

// ===============================
// NAVEGACIÓN DE PESTAÑAS
// ===============================
window.cambiarPestanaChecklist = function (cual) {
  pestanaActiva = cual;
  actualizarPestanas();
};

function actualizarPestanas() {
  const btnChecklist = document.getElementById("tabBtnChecklist");
  const btnCatalogo = document.getElementById("tabBtnCatalogo");

  if (btnChecklist) btnChecklist.classList.toggle("tab-btn--active", pestanaActiva === "checklist");
  if (btnCatalogo) {
    btnCatalogo.style.display = window.checklistSoloLectura ? "none" : "";
    btnCatalogo.classList.toggle("tab-btn--active", pestanaActiva === "catalogo");
  }
  if (pestanaActiva === "checklist") {
    renderPestanaChecklist();
  } else {
    renderPestanaCatalogo();
  }
}

// ===============================
// PESTAÑA 1 — CHECKLIST DEL EVENTO
// ===============================
function renderPestanaChecklist() {
  const cont = document.getElementById("checklistContenido");
  if (!cont) return;

  const evento = window.eventoChecklistActual;
  if (!evento) return;

  const checklist = evento.checklist || [];

  // ---- Barra de progreso ----
  const total = checklist.length;
  const preparados = checklist.filter((i) => i.preparado).length;
  const porcentaje = total > 0 ? Math.round((preparados / total) * 100) : 0;

  let html = `
    <div class="checklist-progreso">
      <div class="checklist-progreso-texto">
        <span>📦 Preparado: ${preparados} / ${total}</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <span>${porcentaje}%</span>
          <button onclick="window.generarPDFChecklist()" class="btn-pdf-checklist">📄 PDF</button>
        </div>
      </div>
      <div class="checklist-progreso-barra">
        <div class="checklist-progreso-fill" style="width:${porcentaje}%"></div>
      </div>
    </div>
  `;

  // ---- Lista de ítems del evento ----
  if (total === 0) {
    html += `<p class="checklist-vacio">No hay ítems en este checklist todavía.<br>Agregá desde el catálogo 👇</p>`;
  } else {
    const grupos = {};
    checklist.forEach((item) => {
      const cat = item.categoria || "OTROS";
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(item);
    });

    Object.entries(grupos).forEach(([categoria, items]) => {
      html += `<div class="checklist-grupo">
        <div class="checklist-categoria">${categoria}</div>`;

      items.forEach((item) => {
        const index = checklist.indexOf(item);
        const soloLectura = window.checklistSoloLectura;
        html += `
  <div class="checklist-item ${item.preparado ? "checklist-item--listo" : ""}">
    <input type="checkbox" class="checklist-check" ${item.preparado ? "checked" : ""}
      ${soloLectura ? "disabled" : `onchange="window.toggleChecklistItem(${index})"`}>
    <span class="checklist-nombre" ${soloLectura ? "" : `onclick="window.toggleChecklistItem(${index})"`}>
      ${item.nombre}
    </span>
    <input type="number" class="checklist-cantidad" value="${item.cantidad}" min="1"
      ${soloLectura ? "disabled" : `onchange="window.cambiarCantidadChecklist(${index}, this.value)"`}>
    ${soloLectura ? "" : `<button type="button" class="checklist-btn-quitar"
      onclick="window.eliminarChecklistItem(${index})">✕</button>`}
  </div>`;
      });

      html += `</div>`;
    });
  }

  // ---- Catálogo para agregar ítems ----
  // ---- Catálogo para agregar ítems ----
  if (!window.checklistSoloLectura) {
    html += `
    <div class="checklist-agregar-titulo">➕ Agregar del catálogo</div>
  <div class="catalogo-buscar">
    <input type="text" id="buscarCatalogo" placeholder="🔍 Buscar ítem..."
      class="catalogo-buscar-input" oninput="window.filtrarCatalogo()">
  </div>
`;
  }

  if (!window.checklistSoloLectura) {
    if (catalogoBase.length === 0) {
      html += `<p class="checklist-vacio">El catálogo está vacío. Añadí ítems desde la pestaña <strong>Catálogo base</strong>.</p>`;
    } else {
      const grupos = {};
      catalogoBase.forEach((item) => {
        if (!grupos[item.categoria]) grupos[item.categoria] = [];
        grupos[item.categoria].push(item);
      });

      Object.entries(grupos).forEach(([categoria, items]) => {
        html += `<div class="catalogo-grupo">
          <div class="catalogo-categoria">${categoria}</div>`;

        items.forEach((item) => {
          const yaAgregado = checklist.some((i) => i.nombre === item.nombre);
          html += `
            <div class="catalogo-item ${yaAgregado ? "catalogo-item--agregado" : ""}">
              <span class="catalogo-item-nombre">${item.nombre}</span>
              <button type="button"
                class="btn-agregar-item ${yaAgregado ? "btn-agregar-item--ya" : ""}"
                onclick="window.agregarChecklistItem('${item.nombre}', '${item.categoria}')"
                ${yaAgregado ? "disabled" : ""}>
                ${yaAgregado ? "✔ Agregado" : "Agregar"}
              </button>
            </div>`;
        });

        html += `</div>`;
      });
    }
  }

  cont.innerHTML = html;
}

window.filtrarCatalogo = function () {
  const term = document.getElementById("buscarCatalogo")?.value.toLowerCase() || "";
  document.querySelectorAll(".catalogo-grupo").forEach((grupo) => {
    let hayVisibles = false;
    grupo.querySelectorAll(".catalogo-item").forEach((el) => {
      const nombre = el.querySelector(".catalogo-item-nombre")?.textContent.toLowerCase() || "";
      const visible = nombre.includes(term);
      el.style.display = visible ? "" : "none";
      if (visible) hayVisibles = true;
    });
    grupo.style.display = hayVisibles ? "" : "none";
  });
};

window.generarPDFChecklist = function () {
  const evento = window.eventoChecklistActual;
  if (!evento) return;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const checklist = evento.checklist || [];
  const total = checklist.length;
  const preparados = checklist.filter(i => i.preparado).length;

  // Encabezado
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("JOOLI Catering", 105, 20, { align: "center" });

  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.text("Checklist de evento", 105, 28, { align: "center" });

  // Datos del evento
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  const fecha = evento.date
    ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
    : "";
  pdf.text(`${evento.client || ""}  ·  ${fecha}`, 105, 38, { align: "center" });

  // Progreso
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`Preparado: ${preparados} / ${total}`, 14, 48);

  pdf.setDrawColor(212, 175, 55);
  pdf.setLineWidth(0.5);
  pdf.line(14, 52, 196, 52);

  if (total === 0) {
    pdf.setFontSize(11);
    pdf.text("No hay ítems en este checklist.", 105, 65, { align: "center" });
  } else {
    // Agrupar por categoría
    const grupos = {};
    checklist.forEach(item => {
      const cat = item.categoria || "OTROS";
      if (!grupos[cat]) grupos[cat] = [];
      grupos[cat].push(item);
    });

    let y = 60;

    Object.entries(grupos).forEach(([categoria, items]) => {
      // Verificar si necesitamos nueva página
      if (y > 270) { pdf.addPage(); y = 20; }

      // Título de categoría
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(22, 160, 133);
      pdf.text(categoria, 14, y);
      y += 6;
      pdf.setTextColor(0, 0, 0);

      items.forEach(item => {
        if (y > 275) { pdf.addPage(); y = 20; }

        // Checkbox
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.rect(14, y - 4, 5, 5);

        // Tilde si está preparado
        if (item.preparado) {
          pdf.setDrawColor(39, 174, 96);
          pdf.setLineWidth(0.8);
          pdf.line(15, y - 1.5, 16.5, y);
          pdf.line(16.5, y, 18.5, y - 3.5);
        }

        // Nombre del ítem
        pdf.setFont("helvetica", item.preparado ? "italic" : "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(item.preparado ? 150 : 0, item.preparado ? 150 : 0, item.preparado ? 150 : 0);
        pdf.text(`${item.nombre}`, 22, y);

        // Cantidad
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(`x${item.cantidad || 1}`, 180, y, { align: "right" });

        pdf.setTextColor(0, 0, 0);
        y += 8;
      });

      y += 4;
    });
  }

  // Pie de página
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generado por JOOLI CateringDesk · ${new Date().toLocaleDateString("es-AR")}`, 105, 290, { align: "center" });

  // Abrir en nueva pestaña
  const pdfBlob = pdf.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
};

// ===============================
// PESTAÑA 2 — CATÁLOGO BASE
// ===============================
function renderPestanaCatalogo() {
  const cont = document.getElementById("checklistContenido");
  if (!cont) return;

  const categoriasExistentes = [...new Set(catalogoBase.map((i) => i.categoria))].sort();

  const opcionesSelect = categoriasExistentes
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  let html = `
    <div class="catalogo-buscar">
      <input type="text" id="buscarCatalogo" placeholder="🔍 Buscar ítem..."
        class="catalogo-buscar-input" oninput="window.filtrarCatalogo()">
    </div>
    <div class="catalogo-nuevo">
      <div class="catalogo-nuevo-titulo">Nuevo ítem</div>
      <div class="catalogo-nuevo-fila">
        <input type="text" id="nuevoItemNombre" placeholder="Nombre del ítem"
          class="catalogo-nuevo-input catalogo-nuevo-input--nombre">

        <select id="selectCategoria" class="catalogo-nuevo-input catalogo-nuevo-input--cat"
          onchange="window.onCategoriaChange()">
          ${categoriasExistentes.length > 0
      ? `<option value="">-- Elegir categoría --</option>${opcionesSelect}`
      : `<option value="">-- Sin categorías aún --</option>`
    }
          <option value="__nueva__">➕ Nueva categoría...</option>
        </select>

        <input type="text" id="nuevoItemCategoria" placeholder="Nombre de la nueva categoría"
          class="catalogo-nuevo-input catalogo-nuevo-input--cat catalogo-nueva-cat-input">

        <button type="button" onclick="window.agregarAlCatalogo()"
          class="btn-catalogo-agregar">+ Agregar</button>
      </div>
    </div>
  `;

  if (catalogoBase.length === 0) {
    html += `<p class="checklist-vacio">El catálogo está vacío. ¡Agregá el primer ítem!</p>`;
  } else {
    const grupos = {};
    catalogoBase.forEach((item) => {
      if (!grupos[item.categoria]) grupos[item.categoria] = [];
      grupos[item.categoria].push(item);
    });

    Object.entries(grupos).forEach(([categoria, items]) => {
      html += `<div class="catalogo-grupo">
        <div class="catalogo-categoria">${categoria}</div>`;

      items.forEach((item) => {
        html += `
          <div class="catalogo-item">
            <span class="catalogo-item-nombre">${item.nombre}</span>
            <button type="button" class="btn-catalogo-eliminar"
              onclick="window.eliminarDelCatalogo('${item.id}')">🗑</button>
          </div>`;
      });

      html += `</div>`;
    });
  }

  cont.innerHTML = html;
}

// ===============================
// ACCIONES — CATÁLOGO BASE
// ===============================
window.agregarAlCatalogo = async function () {
  const nombreEl = document.getElementById("nuevoItemNombre");
  const selectEl = document.getElementById("selectCategoria");
  const nuevaCatEl = document.getElementById("nuevoItemCategoria");

  const nombre = nombreEl?.value.trim().toUpperCase();

  let categoria;
  if (selectEl?.value === "__nueva__") {
    categoria = nuevaCatEl?.value.trim().toUpperCase();
    if (!categoria) {
      window.mostrarAvisoSimple("Faltan datos", "Escribí el nombre de la nueva categoría.", "⚠️");
      return;
    }
  } else {
    categoria = selectEl?.value;
    if (!categoria) {
      window.mostrarAvisoSimple("Faltan datos", "Elegí o creá una categoría.", "⚠️");
      return;
    }
  }

  if (!nombre) {
    window.mostrarAvisoSimple("Faltan datos", "Escribí el nombre del ítem.", "⚠️");
    return;
  }

  const yaExiste = catalogoBase.some(
    (i) => i.nombre.toLowerCase() === nombre.toLowerCase()
  );
  if (yaExiste) {
    window.mostrarAvisoSimple("Ítem duplicado", `<strong>${nombre}</strong> ya existe en el catálogo.`, "⚠️");
    return;
  }

  try {
    await addDoc(collection(db, "catalogoChecklist"), { nombre, categoria });
    if (nombreEl) nombreEl.value = "";
    if (nuevaCatEl) nuevaCatEl.value = "";
    if (selectEl) selectEl.value = "";
  } catch (e) {
    console.error("Error al agregar al catálogo:", e);
  }
};

window.onCategoriaChange = function () {
  const selectEl = document.getElementById("selectCategoria");
  const nuevaCatEl = document.getElementById("nuevoItemCategoria");
  if (!nuevaCatEl) return;
  nuevaCatEl.style.display = selectEl?.value === "__nueva__" ? "block" : "none";
};

window.eliminarDelCatalogo = function (itemId) {
  window.mostrarAvisoSimple(
    "¿Eliminar ítem?",
    "¿Seguro que querés eliminarlo del catálogo?<br><br>" +
    `<button onclick="window.confirmarEliminarCatalogo('${itemId}')" class="btn-aviso-confirmar">Sí, eliminar</button>` +
    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "🗑",
    false
  );
};

window.confirmarEliminarCatalogo = async function (itemId) {
  document.getElementById("modalAvisoSimple").style.display = "none";
  try {
    await deleteDoc(doc(db, "catalogoChecklist", itemId));
  } catch (e) {
    console.error("Error al eliminar del catálogo:", e);
  }
};

window.filtrarCatalogo = function () {
  const term = document.getElementById("buscarCatalogo")?.value.toLowerCase() || "";
  document.querySelectorAll(".catalogo-item").forEach((el) => {
    const nombre = el.querySelector(".catalogo-item-nombre")?.textContent.toLowerCase() || "";
    el.style.display = nombre.includes(term) ? "" : "none";
  });
  document.querySelectorAll(".catalogo-grupo").forEach((grupo) => {
    const hayVisibles = [...grupo.querySelectorAll(".catalogo-item")]
      .some((el) => el.style.display !== "none");
    grupo.style.display = hayVisibles ? "" : "none";
  });
};

// ===============================
// ACCIONES — CHECKLIST DEL EVENTO
// ===============================
window.agregarChecklistItem = async function (nombre, categoria) {
  const evento = window.eventoChecklistActual;
  if (!evento) return;
  if (!evento.checklist) evento.checklist = [];

  if (evento.checklist.some((i) => i.nombre === nombre)) return;

  evento.checklist.push({ nombre, categoria, cantidad: 1, preparado: false });
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
};

window.toggleChecklistItem = async function (index) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist?.[index]) return;

  evento.checklist[index].preparado = !evento.checklist[index].preparado;
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
};

window.cambiarCantidadChecklist = async function (index, valor) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist?.[index]) return;

  evento.checklist[index].cantidad = Number(valor) || 1;
  await guardarChecklistEnFirestore(evento);
};

window.eliminarChecklistItem = async function (index) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist) return;

  evento.checklist.splice(index, 1);
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
};

// ===============================
// FIRESTORE
// ===============================
async function guardarChecklistEnFirestore(evento) {
  if (!evento?.id) return;
  try {
    if (evento._esJornada) {
      // Guardar en la jornada correspondiente
      const eventoReal = evento._eventoReal;
      const jornadaIndex = evento._jornadaIndex;

      eventoReal.jornadas[jornadaIndex].checklist = evento.checklist || [];

      // Sincronizar con el formulario si está abierto
      if (window._jornadasActuales?.[jornadaIndex]) {
        window._jornadasActuales[jornadaIndex].checklist = evento.checklist || [];
      }

      await updateDoc(doc(db, "events", evento.id), {
        jornadas: eventoReal.jornadas,
      });
    } else {
      await updateDoc(doc(db, "events", evento.id), {
        checklist: evento.checklist || [],
      });
      const index = window.allEventsData.findIndex((e) => e.id === evento.id);
      if (index !== -1) {
        window.allEventsData[index].checklist = [...(evento.checklist || [])];
      }
    }
  } catch (error) {
    console.error("Error al guardar checklist:", error);
  }
}

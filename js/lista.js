import { db } from "./auth.js";
import { pushModalHistory, popModalHistory } from "./ui.js";
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

// ---- COCINA ----

function agruparPorCategoria(items = []) {
  const grupos = {};
  items.forEach((item) => {
    const categoria = item.categoria || "OTROS";
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(item);
  });
  return grupos;
}

function ocultarDetalleTemporalmente() {
  const modalDetalle = document.getElementById("modalDetalleEvento");
  if (!modalDetalle) return;

  const estaAbierto = modalDetalle.style.display === "flex";
  if (!estaAbierto) return;

  modalDetalle.dataset.ocultoPorChecklist = "true";
  modalDetalle.style.visibility = "hidden";
  modalDetalle.style.pointerEvents = "none";
}

function restaurarDetalleSiHaceFalta() {
  const modalDetalle = document.getElementById("modalDetalleEvento");
  if (!modalDetalle) return;

  if (modalDetalle.dataset.ocultoPorChecklist === "true") {
    modalDetalle.style.visibility = "visible";
    modalDetalle.style.pointerEvents = "auto";
    delete modalDetalle.dataset.ocultoPorChecklist;
  }
}

function renderCatalogoHTML({
  items = [],
  emptyMessage = "No hay ítems.",
  renderItem,
}) {
  if (!items.length) {
    return `<p class="checklist-vacio">${emptyMessage}</p>`;
  }

  const grupos = agruparPorCategoria(items);
  let html = "";

  Object.entries(grupos).forEach(([categoria, itemsCategoria]) => {
    html += `
      <div class="catalogo-grupo">
        <div class="catalogo-categoria">${categoria}</div>
    `;

    itemsCategoria.forEach((item) => {
      html += renderItem(item);
    });

    html += `</div>`;
  });

  return html;
}

function filtrarCatalogoUI() {
  const term =
    document.getElementById("buscarCatalogo")?.value.toLowerCase().trim() || "";

  document.querySelectorAll(".catalogo-grupo").forEach((grupo) => {
    let hayVisibles = false;

    grupo.querySelectorAll(".catalogo-item").forEach((el) => {
      const nombre =
        el.querySelector(".catalogo-item-nombre")?.textContent.toLowerCase() || "";

      const visible = nombre.includes(term);
      el.style.display = visible ? "" : "none";

      if (visible) hayVisibles = true;
    });

    grupo.style.display = hayVisibles ? "" : "none";
  });
}

window.filtrarCatalogo = function () {
  filtrarCatalogoUI();
};

let catalogoDelegadoInicializado = false;

function initCatalogoDelegado() {
  if (catalogoDelegadoInicializado) return;

  const modal = document.getElementById("modalChecklist");
  if (!modal) return;

  modal.addEventListener("click", async (e) => {
    const btnAgregar = e.target.closest('[data-action="agregar-catalogo"]');
    if (btnAgregar) {
      const id = btnAgregar.dataset.id || "";
      const nombre = btnAgregar.dataset.nombre || "";
      const categoria = btnAgregar.dataset.categoria || "";
      const inputCantidad = document.getElementById(`general-cantidad-${id}`);
      const cantidad = Math.max(1, Number(inputCantidad?.value || 1));

      if (nombre) {
        await agregarChecklistItem(nombre, categoria, cantidad);
      }
      return;
    }

    const btnEliminar = e.target.closest('[data-action="eliminar-catalogo"]');
    if (btnEliminar) {
      const id = btnEliminar.dataset.id || "";
      if (id) {
        eliminarDelCatalogo(id);
      }
    }
  });

  catalogoDelegadoInicializado = true;
}

// ===============================
// INIT
// ===============================
export function initLista() {
  initCatalogoDelegado();
  initChecklistDelegado();
  initControlesListaDelegados();
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
      } else if (pestanaActiva === "vajilla") {
        renderPestanaVajilla();
      } else {
        renderPestanaChecklist();
      }
    }
  });
}


let checklistDelegadoInicializado = false;

function initChecklistDelegado() {
  if (checklistDelegadoInicializado) return;

  const modal = document.getElementById("modalChecklist");
  if (!modal) return;

  modal.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-checklist"]');
    if (toggleBtn && toggleBtn.dataset.index !== undefined) {
      await toggleChecklistItem(Number(toggleBtn.dataset.index));
      return;
    }

    const eliminarBtn = e.target.closest('[data-action="eliminar-checklist"]');
    if (eliminarBtn && eliminarBtn.dataset.index !== undefined) {
      await eliminarChecklistItem(Number(eliminarBtn.dataset.index));
    }
  });

  modal.addEventListener("change", async (e) => {
    const cantidadInput = e.target.closest('[data-action="cantidad-checklist"]');
    if (cantidadInput && cantidadInput.dataset.index !== undefined) {
      await cambiarCantidadChecklist(
        Number(cantidadInput.dataset.index),
        cantidadInput.value
      );
      return;
    }
    const stockDirectoVajilla = e.target.closest('[data-action="editar-stock-vajilla"]');
    if (stockDirectoVajilla) {
      const nuevoStock = Math.max(0, Number(stockDirectoVajilla.value) || 0);
      await ajustarStockVajillaDirecto(stockDirectoVajilla.dataset.id, nuevoStock);
      return;
    }
  });

  checklistDelegadoInicializado = true;
}

let controlesListaInicializados = false;

function initControlesListaDelegados() {
  if (controlesListaInicializados) return;

  const modal = document.getElementById("modalChecklist");
  if (!modal) return;

  modal.addEventListener("input", (e) => {
    const buscarInput = e.target.closest('[data-action="buscar-catalogo"]');
    if (buscarInput) {
      filtrarCatalogoUI();
    }
  });

  modal.addEventListener("change", (e) => {
    const selectCategoria = e.target.closest('[data-action="change-categoria"]');
    if (selectCategoria) {
      onCategoriaChange();
    }
  });

  modal.addEventListener("click", async (e) => {
    const btnAgregarCatalogoBase = e.target.closest('[data-action="agregar-catalogo-base"]');
    if (btnAgregarCatalogoBase) {
      await agregarAlCatalogo();
      return;
    }

    const btnPdf = e.target.closest('[data-action="pdf-checklist"]');
    if (btnPdf) {
      window.generarPDFChecklist();
      return;
    }

    const btnSumarVajilla = e.target.closest('[data-action="sumar-stock-vajilla"]');
    if (btnSumarVajilla) {
      await ajustarStockVajilla(btnSumarVajilla.dataset.id, 1);
      return;
    }
    const btnRestarVajilla = e.target.closest('[data-action="restar-stock-vajilla"]');
    if (btnRestarVajilla) {
      await ajustarStockVajilla(btnRestarVajilla.dataset.id, -1);
      return;
    }
    const btnGuardarVajilla = e.target.closest('[data-action="guardar-vajilla-nuevo"]');
    if (btnGuardarVajilla) {
      await guardarItemVajillaDesdeForm();
      return;
    }
  });

  controlesListaInicializados = true;
}

// ===============================
// ABRIR / CERRAR MODAL
// ===============================
window.abrirModalChecklist = function (eventId) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento) return;

  if (!evento.checklist) evento.checklist = [];

  // Guardar siempre la versión más actual del evento para volver al detalle
  window.eventoChecklistActual = evento;

  const today = new Date().toLocaleDateString("sv").split("T")[0];
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
  const selector = document.getElementById("modalSelectorChecklist");
  if (selector) selector.style.display = "none";

  ocultarDetalleTemporalmente();
  document.getElementById("modalChecklist").style.display = "flex";
  pushModalHistory(window._cerrarChecklistSinPop);
};

window.cerrarModalChecklist = function () {
  const modal = document.getElementById("modalChecklist");
  if (modal) modal.style.display = "none";

  popModalHistory();
  restaurarDetalleSiHaceFalta();
  window.eventoChecklistActual = null;
};

window._cerrarChecklistSinPop = function () {
  const modal = document.getElementById("modalChecklist");
  if (modal) modal.style.display = "none";
  restaurarDetalleSiHaceFalta();
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
  const btnVajilla = document.getElementById("tabBtnVajilla");

  if (btnChecklist) btnChecklist.classList.toggle("tab-btn--active", pestanaActiva === "checklist");
  if (btnCatalogo) {
    btnCatalogo.style.display = window.checklistSoloLectura ? "none" : "";
    btnCatalogo.classList.toggle("tab-btn--active", pestanaActiva === "catalogo");
  }
  if (btnVajilla) {
    btnVajilla.classList.toggle("tab-btn--active", pestanaActiva === "vajilla");
  }
  if (pestanaActiva === "checklist") {
    renderPestanaChecklist();
  } else if (pestanaActiva === "vajilla") {
    renderPestanaVajilla();
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
          <button type="button" class="btn-pdf-checklist" data-action="pdf-checklist">📄 PDF</button>
        </div>
      </div>
      <div class="checklist-progreso-barra">
        <div class="checklist-progreso-fill" style="width:${porcentaje}%"></div>
      </div>
    </div>
  `;

  // ---- Lista de ítems del evento ----

  html += `<div class="checklist-bloque">`;
  html += `<div class="checklist-titulo-bloque">📦 Checklist del evento</div>`;

  if (total === 0) {
    html += `<p class="checklist-vacio">No hay ítems en este checklist todavía.<br>Agregá desde el catálogo 👇</p>`;
  } else {
    const grupos = agruparPorCategoria(checklist);

    Object.entries(grupos).forEach(([categoria, items]) => {
      html += `<div class="checklist-grupo">
      <div class="checklist-categoria">${categoria}</div>`;

      items.forEach((item) => {
        const index = checklist.indexOf(item);
        const soloLectura = window.checklistSoloLectura;

        html += `
        <div class="checklist-item ${item.preparado ? "checklist-item--listo" : ""}">
          <input
            type="checkbox"
            class="checklist-check"
            data-action="toggle-checklist"
            data-index="${index}"
            ${item.preparado ? "checked" : ""}
            ${soloLectura ? "disabled" : ""}
          >

          <span
            class="checklist-nombre"
            ${soloLectura ? "" : `data-action="toggle-checklist" data-index="${index}"`}
          >
            ${item.nombre}
          </span>

          <input
            type="number"
            class="checklist-cantidad"
            data-action="cantidad-checklist"
            data-index="${index}"
            value="${item.cantidad}"
            min="1"
            ${soloLectura ? "disabled" : ""}
          >

          ${soloLectura
            ? ""
            : `<button
                type="button"
                class="checklist-btn-quitar"
                data-action="eliminar-checklist"
                data-index="${index}">
                ✕
              </button>`
          }
        </div>
      `;
      });

      html += `</div>`;
    });
  }

  html += `</div>`;

  // ---- Catálogo para agregar ítems ----
  if (!window.checklistSoloLectura) {
    html += `<div class="catalogo-bloque">`;
    html += `<div class="checklist-titulo-bloque">➕ Catálogo disponible</div>`;

    html += `
    <div class="checklist-agregar-titulo">➕ Agregar del catálogo</div>
    <div class="catalogo-buscar">
      <input
        type="text"
        id="buscarCatalogo"
        placeholder="🔍 Buscar ítem..."
        class="catalogo-buscar-input"
        data-action="buscar-catalogo"
      >
    </div>
  `;

    html += renderCatalogoHTML({
      items: catalogoBase,
      emptyMessage:
        'El catálogo está vacío. Añadí ítems desde la pestaña <strong>Catálogo base</strong>.',
      renderItem: (item) => {
        const yaAgregado = checklist.some((i) => i.nombre === item.nombre);

        if (item.categoria === "VAJILLA") {
          const stock = item.stock || 0;
          const stockClass = stock === 0 ? "camara-stock--vacio" : stock <= 3 ? "camara-stock--bajo" : "camara-stock--ok";
          return `
            <div class="catalogo-item ${yaAgregado ? "catalogo-item--agregado" : ""}">
              <span class="catalogo-item-nombre">${item.nombre}</span>
              <span class="camara-stock-badge ${stockClass}">🍽 ${stock}</span>
              ${yaAgregado
              ? `<span class="btn-general-mini btn-general-mini--ya">✔</span>`
              : stock === 0
                ? `<span class="btn-general-mini btn-general-mini--sin-stock">✕</span>`
                : `<input type="number" id="general-cantidad-${item.id}"
                     class="camara-cantidad-input camara-cantidad-input--mini" value="1" min="1" max="${stock}">
                   <button type="button" class="btn-general-mini"
                     data-action="agregar-catalogo"
                     data-id="${item.id}" data-nombre="${item.nombre}" data-categoria="VAJILLA">↑</button>`
            }
            </div>
          `;
        }

        return `
        <div class="catalogo-item ${yaAgregado ? "catalogo-item--agregado" : ""}">
          <span class="catalogo-item-nombre">${item.nombre}</span>
          ${yaAgregado
            ? `<span class="btn-general-mini btn-general-mini--ya">✔</span>`
            : `
              <input type="number" id="general-cantidad-${item.id}"
                class="camara-cantidad-input camara-cantidad-input--mini" value="1" min="1">
              <button type="button" class="btn-general-mini"
                data-action="agregar-catalogo"
                data-id="${item.id}" data-nombre="${item.nombre}" data-categoria="${item.categoria || ""}">
                ↑
              </button>
            `
          }
        </div>
      `;
      },
    });

    html += `</div>`;
  }
  cont.innerHTML = html;
}

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
    const grupos = agruparPorCategoria(checklist);

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

  const categoriasExistentes = [...new Set(catalogoBase.map((i) => i.categoria))]
    .filter((c) => c !== "VAJILLA")
    .sort();
  const catalogoSinVajilla = catalogoBase.filter((i) => i.categoria !== "VAJILLA");

  const opcionesSelect = categoriasExistentes
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  let html = `
    <div class="catalogo-buscar">
      <input
        type="text"
        id="buscarCatalogo"
        placeholder="🔍 Buscar ítem..."
        class="catalogo-buscar-input"
        data-action="buscar-catalogo"
      >
    </div>
    <div class="catalogo-nuevo">
      <div class="catalogo-nuevo-titulo">Nuevo ítem</div>
      <div class="catalogo-nuevo-fila">
        <input type="text" id="nuevoItemNombre" placeholder="Nombre del ítem"
          class="catalogo-nuevo-input catalogo-nuevo-input--nombre">

        <select
          id="selectCategoria"
          class="catalogo-nuevo-input catalogo-nuevo-input--cat"
          data-action="change-categoria"
        >
          ${categoriasExistentes.length > 0
      ? `<option value="">-- Elegir categoría --</option>${opcionesSelect}`
      : `<option value="">-- Sin categorías aún --</option>`
    }
          <option value="__nueva__">➕ Nueva categoría...</option>
        </select>

        <input
          type="text"
          id="nuevoItemCategoria"
          placeholder="Nombre de la nueva categoría"
          class="catalogo-nuevo-input catalogo-nuevo-input--cat catalogo-nueva-cat-input"
          style="display:none;"
        >

        <button
          type="button"
          class="btn-catalogo-agregar"
          data-action="agregar-catalogo-base"
        >
          + Agregar
        </button>
      </div>
    </div>
  `;

  html += renderCatalogoHTML({
    items: catalogoSinVajilla,
    emptyMessage: "El catálogo está vacío. ¡Agregá el primer ítem!",
    renderItem: (item) => `
      <div class="catalogo-item">
        <span class="catalogo-item-nombre">${item.nombre}</span>
        <button
          type="button"
          class="btn-catalogo-eliminar"
          data-action="eliminar-catalogo"
          data-id="${item.id}">
          🗑
        </button>
      </div>
    `,
  });

  cont.innerHTML = html;
}

// ===============================
// ACCIONES — CATÁLOGO BASE
// ===============================
async function agregarAlCatalogo() {
  const nombreEl = document.getElementById("nuevoItemNombre");
  const selectEl = document.getElementById("selectCategoria");
  const nuevaCatEl = document.getElementById("nuevoItemCategoria");

  const nombre = nombreEl?.value.trim().toUpperCase();

  let categoria;
  if (selectEl?.value === "__nueva__") {
    categoria = nuevaCatEl?.value.trim().toUpperCase();
    if (!categoria) {
      window.mostrarAvisoSimple(
        "Faltan datos",
        "Escribí el nombre de la nueva categoría.",
        "⚠️"
      );
      return;
    }
  } else {
    categoria = selectEl?.value;
    if (!categoria) {
      window.mostrarAvisoSimple(
        "Faltan datos",
        "Elegí o creá una categoría.",
        "⚠️"
      );
      return;
    }
  }

  if (!nombre) {
    window.mostrarAvisoSimple("Faltan datos", "Escribí el nombre del ítem.", "⚠️");
    return;
  }
  if (["VAJILLA"].includes(categoria)) {
    window.mostrarAvisoSimple("Categoría reservada", "Los ítems de vajilla se agregan desde la pestaña 🍽 Vajilla.", "🍽");
    return;
  }

  const yaExiste = catalogoBase.some(
    (i) => i.nombre.toLowerCase() === nombre.toLowerCase()
  );
  if (yaExiste) {
    window.mostrarAvisoSimple(
      "Ítem duplicado",
      `<strong>${nombre}</strong> ya existe en el catálogo.`,
      "⚠️"
    );
    return;
  }

  try {
    await addDoc(collection(db, "catalogoChecklist"), { nombre, categoria });

    if (nombreEl) nombreEl.value = "";
    if (nuevaCatEl) nuevaCatEl.value = "";
    if (selectEl) selectEl.value = "";

    onCategoriaChange();
  } catch (e) {
    console.error("Error al agregar al catálogo:", e);
  }
}

function onCategoriaChange() {
  const selectEl = document.getElementById("selectCategoria");
  const nuevaCatEl = document.getElementById("nuevoItemCategoria");
  if (!nuevaCatEl) return;

  const mostrarNueva = selectEl?.value === "__nueva__";
  nuevaCatEl.style.display = mostrarNueva ? "block" : "none";

  if (!mostrarNueva) {
    nuevaCatEl.value = "";
  }
}

function eliminarDelCatalogo(itemId) {
  window.mostrarAvisoSimple(
    "¿Eliminar ítem?",
    "¿Seguro que querés eliminarlo del catálogo?<br><br>" +
    `<button onclick="window.confirmarEliminarCatalogo('${itemId}')" class="btn-aviso-confirmar">Sí, eliminar</button>` +
    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "🗑",
    false
  );
}

async function confirmarEliminarCatalogo(itemId) {
  document.getElementById("modalAvisoSimple").style.display = "none";

  try {
    await deleteDoc(doc(db, "catalogoChecklist", itemId));
  } catch (e) {
    console.error("Error al eliminar del catálogo:", e);
  }
}

window.confirmarEliminarCatalogo = confirmarEliminarCatalogo;

// ===============================
// SELECTOR DE CHECKLIST
// ===============================
window.abrirSelectorChecklist = function () {
  ocultarDetalleTemporalmente();

  const modal = document.getElementById("modalSelectorChecklist");
  if (modal) modal.style.display = "flex";
  pushModalHistory(window.cerrarSelectorChecklist);
};

window.cerrarSelectorChecklist = function () {
  const modal = document.getElementById("modalSelectorChecklist");
  if (modal) modal.style.display = "none";
  popModalHistory();
  restaurarDetalleSiHaceFalta();
};

window.elegirChecklist = function (tipo) {
  const selector = document.getElementById("modalSelectorChecklist");
  if (selector) selector.style.display = "none";

  const eventId = window._detalleEventoAbierto;
  if (!eventId) return;

  if (tipo === "general") {
    window.abrirModalChecklist(eventId);
  } else {
    window.abrirModalChecklistCocina(eventId);
  }
};


// ===============================
// ACCIONES — CHECKLIST DEL EVENTO
// ===============================

// ===============================
// PESTAÑA VAJILLA
// ===============================
function renderPestanaVajilla() {
  const cont = document.getElementById("checklistContenido");
  if (!cont) return;

  const itemsVajilla = catalogoBase.filter((i) => i.categoria === "VAJILLA");
  const checklist = window.eventoChecklistActual?.checklist || [];

  let html = `
    <div class="camara-header">
      <div class="camara-titulo">🍽 Stock de vajilla</div>
      <div class="camara-subtitulo">Tocá + / − para ajustar el stock disponible</div>
    </div>
  `;

  if (!window.checklistSoloLectura) {
    html += `
      <div class="camara-nuevo">
        <div class="catalogo-nuevo-titulo">Agregar ítem de vajilla</div>
        <div class="camara-nuevo-fila">
          <input type="text" id="vajillaNuevoNombre" placeholder="Nombre (ej: PLATOS, COPAS...)"
            class="catalogo-nuevo-input catalogo-nuevo-input--nombre">
          <input type="number" id="vajillaNuevoStock" placeholder="Cantidad" min="0"
            class="catalogo-nuevo-input" style="max-width:90px;">
          <button type="button" class="btn-catalogo-agregar" data-action="guardar-vajilla-nuevo">
            + Agregar
          </button>
        </div>
      </div>
    `;
  }

  if (itemsVajilla.length === 0) {
    html += `<p class="checklist-vacio">No hay ítems de vajilla todavía.</p>`;
  } else {
    html += `<div class="camara-lista">`;
    itemsVajilla.forEach((item) => {
      const stock = item.stock || 0;
      const stockClass = stock === 0 ? "camara-stock--vacio" : stock <= 3 ? "camara-stock--bajo" : "camara-stock--ok";
      html += `
        <div class="camara-item">
          <div class="camara-item-nombre">${item.nombre}</div>
          <div class="camara-item-controles">
            <button type="button" class="btn-stock btn-stock--restar" data-action="restar-stock-vajilla" data-id="${item.id}">−</button>
            <input type="number" class="camara-stock ${stockClass}"
              data-action="editar-stock-vajilla" data-id="${item.id}"
              value="${stock}" min="0">
            <button type="button" class="btn-stock btn-stock--sumar" data-action="sumar-stock-vajilla" data-id="${item.id}">+</button>
          </div>
          ${!window.checklistSoloLectura ? `
          <button type="button" class="btn-catalogo-eliminar"
            data-action="eliminar-catalogo" data-id="${item.id}">🗑</button>` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }

  cont.innerHTML = html;
}

async function ajustarStockVajilla(itemId, delta) {
  const item = catalogoBase.find((i) => i.id === itemId);
  if (!item) return;
  const nuevoStock = Math.max(0, (item.stock || 0) + delta);
  try {
    await updateDoc(doc(db, "catalogoChecklist", itemId), { stock: nuevoStock });
  } catch (e) {
    console.error("Error al ajustar stock vajilla:", e);
  }
}

window.devolverStockVajilla = async function (nombre, cantidad) {
  const item = catalogoBase.find((i) => i.nombre === nombre && i.categoria === "VAJILLA");
  if (!item) return;
  const nuevoStock = (item.stock || 0) + cantidad;
  try {
    await updateDoc(doc(db, "catalogoChecklist", item.id), { stock: nuevoStock });
  } catch (e) {
    console.error("Error al devolver stock vajilla:", e);
  }
};

async function ajustarStockVajillaDirecto(itemId, nuevoStock) {
  try {
    await updateDoc(doc(db, "catalogoChecklist", itemId), { stock: nuevoStock });
  } catch (e) {
    console.error("Error al editar stock vajilla directo:", e);
  }
}

async function guardarItemVajillaDesdeForm() {
  const nombreEl = document.getElementById("vajillaNuevoNombre");
  const stockEl = document.getElementById("vajillaNuevoStock");
  const nombre = nombreEl?.value.trim().toUpperCase();
  const stock = Number(stockEl?.value) || 0;

  if (!nombre) {
    window.mostrarAvisoSimple("Faltan datos", "Escribí el nombre del ítem.", "⚠️");
    return;
  }
  const yaExiste = catalogoBase.some(
    (i) => i.nombre.toLowerCase() === nombre.toLowerCase() && i.categoria === "VAJILLA"
  );
  if (yaExiste) {
    window.mostrarAvisoSimple("Ítem duplicado", `<strong>${nombre}</strong> ya existe en vajilla.`, "⚠️");
    return;
  }
  try {
    await addDoc(collection(db, "catalogoChecklist"), { nombre, categoria: "VAJILLA", stock });
    if (nombreEl) nombreEl.value = "";
    if (stockEl) stockEl.value = "";
  } catch (e) {
    console.error("Error al agregar ítem a vajilla:", e);
  }
}

async function agregarChecklistItem(nombre, categoria, cantidad = 1) {
  const evento = window.eventoChecklistActual;
  if (!evento) return;
  if (!evento.checklist) evento.checklist = [];

  if (evento.checklist.some((i) => i.nombre === nombre)) return;

  if (categoria === "VAJILLA") {
    const itemVajilla = catalogoBase.find((i) => i.nombre === nombre && i.categoria === "VAJILLA");
    if (itemVajilla) {
      const stockActual = itemVajilla.stock || 0;
      if (cantidad > stockActual) {
        window.mostrarAvisoSimple(
          "Stock insuficiente",
          `Solo hay <strong>${stockActual}</strong> unidad${stockActual !== 1 ? "es" : ""} de <strong>${nombre}</strong> disponible${stockActual !== 1 ? "s" : ""}.`,
          "🍽"
        );
        return;
      }
      await ajustarStockVajilla(itemVajilla.id, -Number(cantidad));
    }
  }

  evento.checklist.push({ nombre, categoria, cantidad: Number(cantidad) || 1, preparado: false });
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
}
async function toggleChecklistItem(index) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist?.[index]) return;

  evento.checklist[index].preparado = !evento.checklist[index].preparado;
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
}

async function cambiarCantidadChecklist(index, valor) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist?.[index]) return;

  const item = evento.checklist[index];
  const nuevaCantidad = Number(valor) || 1;

  if (item.categoria === "VAJILLA") {
    const itemVajilla = catalogoBase.find((i) => i.nombre === item.nombre && i.categoria === "VAJILLA");
    if (itemVajilla) {
      const cantidadAnterior = item.cantidad || 1;
      const diferencia = nuevaCantidad - cantidadAnterior;
      const stockActual = itemVajilla.stock || 0;
      if (diferencia > stockActual) {
        window.mostrarAvisoSimple(
          "Stock insuficiente",
          `Solo hay <strong>${stockActual}</strong> unidad${stockActual !== 1 ? "es" : ""} disponible${stockActual !== 1 ? "s" : ""} de <strong>${item.nombre}</strong>.`,
          "🍽"
        );
        renderPestanaChecklist();
        return;
      }
      await ajustarStockVajilla(itemVajilla.id, -diferencia);
    }
  }

  evento.checklist[index].cantidad = nuevaCantidad;
  await guardarChecklistEnFirestore(evento);
}

async function eliminarChecklistItem(index) {
  const evento = window.eventoChecklistActual;
  if (!evento || !evento.checklist) return;

  const item = evento.checklist[index];
  if (item && item.categoria === "VAJILLA") {
    const itemVajilla = catalogoBase.find((i) => i.nombre === item.nombre && i.categoria === "VAJILLA");
    if (itemVajilla) {
      await ajustarStockVajilla(itemVajilla.id, Number(item.cantidad) || 1);
    }
  }

  evento.checklist.splice(index, 1);
  await guardarChecklistEnFirestore(evento);
  renderPestanaChecklist();
}

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

      const checklistActualizado = [...(evento.checklist || [])];

      await updateDoc(doc(db, "events", evento.id), {
        checklist: checklistActualizado,
      });

      // actualizar en memoria principal
      const index = window.allEventsData.findIndex((e) => e.id === evento.id);
      if (index !== -1) {
        window.allEventsData[index].checklist = checklistActualizado;
      }

      // mantener sincronizado el evento del modal checklist
      if (window.eventoChecklistActual?.id === evento.id) {
        window.eventoChecklistActual.checklist = checklistActualizado;
      }

      // 🔴 ESTE ES EL FIX IMPORTANTE
      const modalDetalle = document.getElementById("modalDetalleEvento");

      if (
        modalDetalle &&
        modalDetalle.style.display === "flex" &&
        window._detalleEventoAbierto === evento.id &&
        typeof window.abrirModalDetalle === "function"
      ) {
        window.abrirModalDetalle(evento.id);
      }
    }
  } catch (error) {
    console.error("Error al guardar checklist:", error);
  }
}
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

// Variables propias de cocina
let catalogoBaseCocina = [];
let pestanaActivaCocina = "checklist"; // "checklist" | "catalogo" | "camara"

// ---- Helpers (compartidos con lista.js, copiados para independencia) ----
function agruparPorCategoria(items = []) {
  const grupos = {};
  items.forEach((item) => {
    const categoria = item.categoria || "OTROS";
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria].push(item);
  });
  return grupos;
}

function renderCatalogoHTML({ items = [], emptyMessage = "No hay ítems.", renderItem }) {
  if (!items.length) return `<p class="checklist-vacio">${emptyMessage}</p>`;
  const grupos = agruparPorCategoria(items);
  let html = "";
  Object.entries(grupos).forEach(([categoria, itemsCategoria]) => {
    html += `<div class="catalogo-grupo"><div class="catalogo-categoria">${categoria}</div>`;
    itemsCategoria.forEach((item) => { html += renderItem(item); });
    html += `</div>`;
  });
  return html;
}

function ocultarDetalleTemporalmente() {
  const modalDetalle = document.getElementById("modalDetalleEvento");
  if (!modalDetalle) return;
  if (modalDetalle.style.display !== "flex") return;
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

// ===============================
// CHECKLIST COCINA — DELEGADOS
// ===============================
let catalogoCocinaDelegate = false;
function initCatalogoCocinaDelegate() {
  if (catalogoCocinaDelegate) return;
  const modal = document.getElementById("modalChecklistCocina");
  if (!modal) return;

  modal.addEventListener("click", async (e) => {
    const btnAgregar = e.target.closest('[data-action="agregar-catalogo-cocina"]');
    if (btnAgregar) {
      const id = btnAgregar.dataset.id || "";
      const nombre = btnAgregar.dataset.nombre || "";
      const categoria = btnAgregar.dataset.categoria || "";
      const inputCantidad = document.getElementById(`cocina-cantidad-${id}`);
      const cantidad = Math.max(1, Number(inputCantidad?.value || 1));

      if (nombre) {
        await agregarChecklistCocinaItem(nombre, categoria, cantidad);
      }
      return;
    }
    const btnEliminar = e.target.closest('[data-action="eliminar-catalogo-cocina"]');
    if (btnEliminar) {
      const id = btnEliminar.dataset.id || "";
      if (id) eliminarDelCatalogoCocina(id);
    }
  });

  catalogoCocinaDelegate = true;
}

let checklistCocinaDelegate = false;
function initChecklistCocinaDelegate() {
  if (checklistCocinaDelegate) return;
  const modal = document.getElementById("modalChecklistCocina");
  if (!modal) return;

  modal.addEventListener("change", async (e) => {
    const cantidadInput = e.target.closest('[data-action="cantidad-checklist-cocina"]');
    if (cantidadInput && cantidadInput.dataset.index !== undefined) {
      await cambiarCantidadChecklistCocina(Number(cantidadInput.dataset.index), Number(cantidadInput.value));
      return;
    }
    const stockDirecto = e.target.closest('[data-action="editar-stock-directo"]');
    if (stockDirecto) {
      const nuevoStock = Math.max(0, Number(stockDirecto.value) || 0);
      await ajustarStockDirecto(stockDirecto.dataset.id, nuevoStock);
      return;
    }
  });

  modal.addEventListener("click", async (e) => {
    const toggleBtn = e.target.closest('[data-action="toggle-checklist-cocina"]');
    if (toggleBtn && toggleBtn.dataset.index !== undefined) {
      await toggleChecklistCocinaItem(Number(toggleBtn.dataset.index));
      return;
    }
    const eliminarBtn = e.target.closest('[data-action="eliminar-checklist-cocina"]');
    if (eliminarBtn && eliminarBtn.dataset.index !== undefined) {
      await eliminarChecklistCocinaItem(Number(eliminarBtn.dataset.index));
    }
  });

  modal.addEventListener("change", async (e) => {
    const cantidadInput = e.target.closest('[data-action="cantidad-checklist-cocina"]');
    if (cantidadInput && cantidadInput.dataset.index !== undefined) {
      await cambiarCantidadChecklistCocina(Number(cantidadInput.dataset.index), cantidadInput.value);
    }
  });

  checklistCocinaDelegate = true;
}

let controlesCocinaDelegate = false;
function initControlesCocinaDelegate() {
  if (controlesCocinaDelegate) return;
  const modal = document.getElementById("modalChecklistCocina");
  if (!modal) return;

  modal.addEventListener("input", (e) => {
    const buscarInput = e.target.closest('[data-action="buscar-catalogo-cocina"]');
    if (buscarInput) filtrarCatalogoUICocina();
  });

  modal.addEventListener("change", (e) => {
    const selectCategoria = e.target.closest('[data-action="change-categoria-cocina"]');
    if (selectCategoria) onCategoriaChangeCocina();
  });

  modal.addEventListener("click", async (e) => {
    const btnAgregarBase = e.target.closest('[data-action="agregar-catalogo-base-cocina"]');
    if (btnAgregarBase) {
      await agregarAlCatalogoCocina();
      return;
    }
    const btnPdf = e.target.closest('[data-action="pdf-checklist-cocina"]');
    if (btnPdf) {
      window.generarPDFChecklistCocina();
      return;
    }
    const btnPanaderia = e.target.closest('[data-action="whatsapp-panaderia"]');
    if (btnPanaderia) {
      enviarPedidoPanaderia();
      return;
    }
    const btnSumarStock = e.target.closest('[data-action="sumar-stock"]');
    if (btnSumarStock) {
      await ajustarStock(btnSumarStock.dataset.id, 1);
      return;
    }
    const btnRestarStock = e.target.closest('[data-action="restar-stock"]');
    if (btnRestarStock) {
      await ajustarStock(btnRestarStock.dataset.id, -1);
      return;
    }
    const btnGuardarStock = e.target.closest('[data-action="guardar-stock-nuevo"]');
    if (btnGuardarStock) {
      await guardarItemCamaraDesdeForm();
      return;
    }
    const btnAgregarDesdeCamera = e.target.closest('[data-action="agregar-camara-al-checklist"]');
    if (btnAgregarDesdeCamera) {
      const id = btnAgregarDesdeCamera.dataset.id;
      const nombre = btnAgregarDesdeCamera.dataset.nombre;
      const categoria = btnAgregarDesdeCamera.dataset.categoria;
      const cantidadInput = document.getElementById(`camara-cantidad-${id}`);
      const cantidad = Number(cantidadInput?.value) || 1;
      await agregarDesdeCamera(id, nombre, categoria, cantidad);
      return;
    }
  });

  controlesCocinaDelegate = true;
}

// ===============================
// CHECKLIST COCINA — CATÁLOGO
// ===============================
function cargarCatalogoCocina() {
  const q = query(
    collection(db, "catalogoChecklistCocina"),
    orderBy("categoria"),
    orderBy("nombre")
  );
  onSnapshot(q, (snap) => {
    catalogoBaseCocina = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const modal = document.getElementById("modalChecklistCocina");
    if (modal && modal.style.display === "flex") {
      if (pestanaActivaCocina === "catalogo") {
        renderPestanaCatalogoCocina();
      } else if (pestanaActivaCocina === "camara") {
        renderPestanaCamara();
      } else {
        renderPestanaChecklistCocina();
      }
    }
  });
}

function filtrarCatalogoUICocina() {
  const term = document.getElementById("buscarCatalogoCocina")?.value.toLowerCase().trim() || "";
  document.querySelectorAll("#checklistCocinaContenido .catalogo-grupo").forEach((grupo) => {
    let hayVisibles = false;
    grupo.querySelectorAll(".catalogo-item").forEach((el) => {
      const nombre = el.querySelector(".catalogo-item-nombre")?.textContent.toLowerCase() || "";
      const visible = nombre.includes(term);
      el.style.display = visible ? "" : "none";
      if (visible) hayVisibles = true;
    });
    grupo.style.display = hayVisibles ? "" : "none";
  });
}

// ===============================
// CHECKLIST COCINA — ABRIR/CERRAR
// ===============================
window.abrirModalChecklistCocina = function (eventId) {
  const evento = window.allEventsData.find((e) => e.id === eventId);
  if (!evento) return;

  if (!evento.checklistCocina) evento.checklistCocina = [];

  window.eventoChecklistCocinaActual = evento;

  const today = new Date().toLocaleDateString("sv").split("T")[0];
  window.checklistCocinaSoloLectura = evento.date < today;

  pestanaActivaCocina = "checklist";

  const titulo = document.getElementById("tituloModalChecklistCocina");
  if (titulo) {
    const fecha = evento.date
      ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
      : "";
    titulo.innerText = `🍳 ${fecha} · ${evento.client}`;
  }

  actualizarPestanasCocina();
  const selector = document.getElementById("modalSelectorChecklist");
  if (selector) selector.style.display = "none";

  ocultarDetalleTemporalmente();
  document.getElementById("modalChecklistCocina").style.display = "flex";
  pushModalHistory(window._cerrarChecklistCocinaSinPop);
};

window.cerrarModalChecklistCocina = function () {
  const modal = document.getElementById("modalChecklistCocina");
  if (modal) modal.style.display = "none";

  popModalHistory();
  restaurarDetalleSiHaceFalta();
  window.eventoChecklistCocinaActual = null;
};

window._cerrarChecklistCocinaSinPop = function () {
  const modal = document.getElementById("modalChecklistCocina");
  if (modal) modal.style.display = "none";
  restaurarDetalleSiHaceFalta();
  window.eventoChecklistCocinaActual = null;
};

window.cambiarPestanaChecklistCocina = function (cual) {
  pestanaActivaCocina = cual;
  actualizarPestanasCocina();
};

function actualizarPestanasCocina() {
  const btnChecklist = document.getElementById("tabBtnChecklistCocina");
  const btnCatalogo = document.getElementById("tabBtnCatalogoCocina");
  const btnCamara = document.getElementById("tabBtnCamaraCocina");

  if (btnChecklist) btnChecklist.classList.toggle("tab-btn--active", pestanaActivaCocina === "checklist");
  if (btnCatalogo) {
    btnCatalogo.style.display = window.checklistCocinaSoloLectura ? "none" : "";
    btnCatalogo.classList.toggle("tab-btn--active", pestanaActivaCocina === "catalogo");
  }
  if (btnCamara) btnCamara.classList.toggle("tab-btn--active", pestanaActivaCocina === "camara");

  if (pestanaActivaCocina === "checklist") {
    renderPestanaChecklistCocina();
  } else if (pestanaActivaCocina === "catalogo") {
    renderPestanaCatalogoCocina();
  } else {
    renderPestanaCamara();
  }
}

// ===============================
// CHECKLIST COCINA — PESTAÑA 1
// ===============================

function enviarPedidoPanaderia() {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento) return;

  const itemsPanaderia = (evento.checklistCocina || []).filter(
    (i) => i.categoria?.toUpperCase() === "PANADERÍA" || i.categoria?.toUpperCase() === "PANADERIA"
  );

  if (itemsPanaderia.length === 0) {
    window.mostrarAvisoSimple(
      "Sin ítems",
      "No hay ítems de panadería en este checklist.",
      "🥖"
    );
    return;
  }

  const fecha = evento.date
    ? new Date(evento.date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "fecha a confirmar";

  let mensaje = `Hola! 👋 Soy de *JOOLI Catering*.\n\nNecesitamos el siguiente pedido de panadería para el *${fecha}*:\n\n`;
  itemsPanaderia.forEach((item) => {
    mensaje += `• ${item.nombre}: *${item.cantidad}*\n`;
  });
  mensaje += `\nMuchas gracias!`;

  const url = `https://wa.me/5493517371756?text=${encodeURIComponent(mensaje)}`;
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderPestanaChecklistCocina() {
  const cont = document.getElementById("checklistCocinaContenido");
  if (!cont) return;

  const evento = window.eventoChecklistCocinaActual;
  if (!evento) return;

  const checklist = evento.checklistCocina || [];
  const total = checklist.length;
  const preparados = checklist.filter((i) => i.preparado).length;
  const porcentaje = total > 0 ? Math.round((preparados / total) * 100) : 0;

  let html = `
    <div class="checklist-progreso">
      <div class="checklist-progreso-texto">
        <span>🍳 Preparado: ${preparados} / ${total}</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <span>${porcentaje}%</span>
          <button type="button" class="btn-pdf-checklist" data-action="pdf-checklist-cocina">📄 PDF</button>
        </div>
      </div>
      <div class="checklist-progreso-barra">
        <div class="checklist-progreso-fill" style="width:${porcentaje}%"></div>
      </div>
    </div>
  `;

  html += `<div class="checklist-bloque">`;
  html += `<div class="checklist-titulo-bloque">🍳 Checklist de cocina</div>`;

  if (total === 0) {
    html += `<p class="checklist-vacio">No hay ítems en este checklist todavía.<br>Agregá desde el catálogo 👇</p>`;
  } else {
    const grupos = agruparPorCategoria(checklist);
    Object.entries(grupos).forEach(([categoria, items]) => {

      const esPanaderia = categoria.toUpperCase().includes("PANADER");
      const hayItems = items && items.length > 0;

      html += `
    <div class="checklist-grupo">
      <div class="checklist-categoria" style="display:flex; justify-content:space-between; align-items:center;">
        <span>${categoria}</span>

        ${(esPanaderia && hayItems) ? `
          <button type="button"
            class="btn-panaderia-mini ${evento.panaderiaEnviada ? "btn-panaderia-mini--enviado" : ""}"
            data-action="whatsapp-panaderia"
            ${evento.panaderiaEnviada ? "disabled" : ""}>
            🥖
          </button>
        ` : ""}
      </div>
  `;
      items.forEach((item) => {
        const index = checklist.indexOf(item);
        const soloLectura = window.checklistCocinaSoloLectura;
        html += `
        <div class="checklist-item ${item.preparado ? "checklist-item--listo" : ""}">
          <input type="checkbox" class="checklist-check"
            data-action="toggle-checklist-cocina" data-index="${index}"
            ${item.preparado ? "checked" : ""} ${soloLectura ? "disabled" : ""}>
          <span class="checklist-nombre"
            ${soloLectura ? "" : `data-action="toggle-checklist-cocina" data-index="${index}"`}>
            ${item.nombre}
          </span>
          <input type="number" class="checklist-cantidad"
            data-action="cantidad-checklist-cocina" data-index="${index}"
            value="${item.cantidad}" min="1" ${soloLectura ? "disabled" : ""}>
          ${soloLectura ? "" : `<button type="button" class="checklist-btn-quitar"
            data-action="eliminar-checklist-cocina" data-index="${index}">✕</button>`}
        </div>
      `;
      });
      html += `</div>`;
    });
  }

  html += `</div>`;

  if (!window.checklistCocinaSoloLectura) {
    html += `<div class="catalogo-bloque">`;
    html += `<div class="checklist-titulo-bloque">➕ Catálogo disponible</div>`;

    html += `
    <div class="checklist-agregar-titulo">➕ Agregar del catálogo</div>
    <div class="catalogo-buscar">
      <input type="text" id="buscarCatalogoCocina" placeholder="🔍 Buscar ítem..."
        class="catalogo-buscar-input" data-action="buscar-catalogo-cocina">
    </div>
  `;

    html += renderCatalogoHTML({
      items: catalogoBaseCocina,
      emptyMessage: 'El catálogo está vacío. Añadí ítems desde la pestaña <strong>Catálogo base</strong>.',
      renderItem: (item) => {
        const yaAgregado = checklist.some((i) => i.nombre === item.nombre);

        if (item.categoria === "CAMARA") {
          const stock = item.stock || 0;
          const stockClass = stock === 0 ? "camara-stock--vacio" : stock <= 3 ? "camara-stock--bajo" : "camara-stock--ok";
          return `
          <div class="catalogo-item ${yaAgregado ? "catalogo-item--agregado" : ""}">
            <span class="catalogo-item-nombre">${item.nombre}</span>
            <span class="camara-stock-badge ${stockClass}">🧊 ${stock}</span>
            ${yaAgregado
              ? `<span class="btn-camara-mini btn-camara-mini--ya">✔</span>`
              : stock === 0
                ? `<span class="btn-camara-mini btn-camara-mini--sin-stock">✕</span>`
                : `<input type="number" id="camara-cantidad-${item.id}" class="camara-cantidad-input camara-cantidad-input--mini" value="1" min="1" max="${stock}">
                   <button type="button" class="btn-camara-mini" data-action="agregar-camara-al-checklist"
                     data-id="${item.id}" data-nombre="${item.nombre}" data-categoria="CAMARA">↑</button>`
            }
          </div>
        `;
        }

        return `
        <div class="catalogo-item ${yaAgregado ? "catalogo-item--agregado" : ""}">
          <span class="catalogo-item-nombre">${item.nombre}</span>

          ${yaAgregado
            ? `<span class="btn-camara-mini btn-camara-mini--ya">✔</span>`
            : `
              <input
                type="number"
                id="cocina-cantidad-${item.id}"
                class="camara-cantidad-input camara-cantidad-input--mini"
                value="1"
                min="1"
              >
              <button
                type="button"
                class="btn-camara-mini"
                data-action="agregar-catalogo-cocina"
                data-id="${item.id}"
                data-nombre="${item.nombre}"
                data-categoria="${item.categoria || ""}">
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

// ===============================
// CHECKLIST COCINA — PESTAÑA 2
// ===============================
function renderPestanaCatalogoCocina() {
  const cont = document.getElementById("checklistCocinaContenido");
  if (!cont) return;

  const categoriasExistentes = [...new Set(catalogoBaseCocina.map((i) => i.categoria))]
    .filter((c) => c !== "CAMARA")
    .sort();
  const catalogoSinCamara = catalogoBaseCocina.filter((i) => i.categoria !== "CAMARA");
  const opcionesSelect = categoriasExistentes.map((c) => `<option value="${c}">${c}</option>`).join("");

  let html = `
    <div class="catalogo-buscar">
      <input type="text" id="buscarCatalogoCocina" placeholder="🔍 Buscar ítem..."
        class="catalogo-buscar-input" data-action="buscar-catalogo-cocina">
    </div>
    <div class="catalogo-nuevo">
      <div class="catalogo-nuevo-titulo">Nuevo ítem</div>
      <div class="catalogo-nuevo-fila">
        <input type="text" id="nuevoItemNombreCocina" placeholder="Nombre del ítem"
          class="catalogo-nuevo-input catalogo-nuevo-input--nombre">
        <select id="selectCategoriaCocina" class="catalogo-nuevo-input catalogo-nuevo-input--cat"
          data-action="change-categoria-cocina">
          ${categoriasExistentes.length > 0
      ? `<option value="">-- Elegir categoría --</option>${opcionesSelect}`
      : `<option value="">-- Sin categorías aún --</option>`}
          <option value="__nueva__">➕ Nueva categoría...</option>
        </select>
        <input type="text" id="nuevoItemCategoriaCocina" placeholder="Nombre de la nueva categoría"
          class="catalogo-nuevo-input catalogo-nuevo-input--cat catalogo-nueva-cat-input"
          style="display:none;">
        <button type="button" class="btn-catalogo-agregar" data-action="agregar-catalogo-base-cocina">
          + Agregar
        </button>
      </div>
    </div>
  `;

  html += renderCatalogoHTML({
    items: catalogoSinCamara,
    emptyMessage: "El catálogo está vacío. ¡Agregá el primer ítem!",
    renderItem: (item) => `
      <div class="catalogo-item">
        <span class="catalogo-item-nombre">${item.nombre}</span>
        <button type="button" class="btn-catalogo-eliminar"
          data-action="eliminar-catalogo-cocina" data-id="${item.id}">🗑</button>
      </div>
    `,
  });

  cont.innerHTML = html;
}

// ===============================
// CHECKLIST COCINA — ACCIONES
// ===============================

async function cambiarCantidadChecklistCocina(index, nuevaCantidad) {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento || !evento.checklistCocina) return;
  const item = evento.checklistCocina[index];
  if (!item) return;
  if (!nuevaCantidad || nuevaCantidad < 1) return;

  if (item.categoria === "CAMARA") {
    const itemCamara = catalogoBaseCocina.find(
      (i) => i.nombre === item.nombre && i.categoria === "CAMARA"
    );
    if (itemCamara) {
      const cantidadAnterior = item.cantidad || 1;
      const diferencia = nuevaCantidad - cantidadAnterior;
      const stockActual = itemCamara.stock || 0;
      if (diferencia > stockActual) {
        window.mostrarAvisoSimple(
          "Stock insuficiente",
          `Solo hay <strong>${stockActual}</strong> unidad${stockActual !== 1 ? "es" : ""} disponible${stockActual !== 1 ? "s" : ""} de <strong>${item.nombre}</strong> en cámara.`,
          "🧊"
        );
        renderPestanaChecklistCocina();
        return;
      }
      await ajustarStock(itemCamara.id, -diferencia);
    }
  }

  evento.checklistCocina[index].cantidad = nuevaCantidad;
  await guardarChecklistCocinaEnFirestore(evento);
  renderPestanaChecklistCocina();
}

async function agregarChecklistCocinaItem(nombre, categoria, cantidadSolicitada = 1) {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento) return;
  if (!evento.checklistCocina) evento.checklistCocina = [];
  if (evento.checklistCocina.some((i) => i.nombre === nombre)) return;

  // Si es ítem de cámara, verificar y descontar stock
  if (categoria === "CAMARA") {
    const itemCamara = catalogoBaseCocina.find(
      (i) => i.nombre === nombre && i.categoria === "CAMARA"
    );
    if (itemCamara) {
      const stockActual = itemCamara.stock || 0;
      if (cantidadSolicitada > stockActual) {
        window.mostrarAvisoSimple(
          "Stock insuficiente",
          `Solo hay <strong>${stockActual}</strong> unidad${stockActual !== 1 ? "es" : ""} de <strong>${nombre}</strong> en cámara.`,
          "🧊"
        );
        return;
      }
      await ajustarStock(itemCamara.id, -cantidadSolicitada);
    }
  }

  evento.checklistCocina.push({ nombre, categoria, cantidad: cantidadSolicitada, preparado: false });
  await guardarChecklistCocinaEnFirestore(evento);
  renderPestanaChecklistCocina();
}

async function toggleChecklistCocinaItem(index) {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento || !evento.checklistCocina?.[index]) return;
  evento.checklistCocina[index].preparado = !evento.checklistCocina[index].preparado;
  await guardarChecklistCocinaEnFirestore(evento);
  renderPestanaChecklistCocina();
}

async function eliminarChecklistCocinaItem(index) {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento || !evento.checklistCocina) return;

  const item = evento.checklistCocina[index];

  // Si era ítem de cámara, devolver stock
  if (item && item.categoria === "CAMARA") {
    const itemCamara = catalogoBaseCocina.find(
      (i) => i.nombre === item.nombre && i.categoria === "CAMARA"
    );
    if (itemCamara) {
      await ajustarStock(itemCamara.id, Number(item.cantidad) || 1);
    }
  }

  evento.checklistCocina.splice(index, 1);
  await guardarChecklistCocinaEnFirestore(evento);
  renderPestanaChecklistCocina();
}

async function guardarChecklistCocinaEnFirestore(evento) {
  if (!evento?.id) return;
  try {
    await updateDoc(doc(db, "events", evento.id), {
      checklistCocina: evento.checklistCocina || [],
    });
    const index = window.allEventsData.findIndex((e) => e.id === evento.id);
    if (index !== -1) {
      window.allEventsData[index].checklistCocina = [...(evento.checklistCocina || [])];
    }
    if (window.eventoChecklistCocinaActual?.id === evento.id) {
      window.eventoChecklistCocinaActual.checklistCocina = [...(evento.checklistCocina || [])];
    }
  } catch (error) {
    console.error("Error al guardar checklist cocina:", error);
  }
}

// ===============================
// CHECKLIST COCINA — CATÁLOGO BASE
// ===============================
async function agregarAlCatalogoCocina() {
  const nombreEl = document.getElementById("nuevoItemNombreCocina");
  const selectEl = document.getElementById("selectCategoriaCocina");
  const nuevaCatEl = document.getElementById("nuevoItemCategoriaCocina");

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
  if (["CAMARA", "CÁMARA"].includes(categoria)) {
    window.mostrarAvisoSimple("Categoría reservada", "Los ítems de cámara se agregan desde la pestaña 🧊 Cámara.", "🧊");
    return;
  }

  const yaExiste = catalogoBaseCocina.some((i) => i.nombre.toLowerCase() === nombre.toLowerCase());
  if (yaExiste) {
    window.mostrarAvisoSimple("Ítem duplicado", `<strong>${nombre}</strong> ya existe en el catálogo.`, "⚠️");
    return;
  }

  try {
    await addDoc(collection(db, "catalogoChecklistCocina"), { nombre, categoria });
    if (nombreEl) nombreEl.value = "";
    if (nuevaCatEl) nuevaCatEl.value = "";
    if (selectEl) selectEl.value = "";
    onCategoriaChangeCocina();
  } catch (e) {
    console.error("Error al agregar al catálogo cocina:", e);
  }
}

function onCategoriaChangeCocina() {
  const selectEl = document.getElementById("selectCategoriaCocina");
  const nuevaCatEl = document.getElementById("nuevoItemCategoriaCocina");
  if (!nuevaCatEl) return;
  const mostrarNueva = selectEl?.value === "__nueva__";
  nuevaCatEl.style.display = mostrarNueva ? "block" : "none";
  if (!mostrarNueva) nuevaCatEl.value = "";
}

function eliminarDelCatalogoCocina(itemId) {
  window.mostrarAvisoSimple(
    "¿Eliminar ítem?",
    "¿Seguro que querés eliminarlo del catálogo de cocina?<br><br>" +
    `<button onclick="window.confirmarEliminarCatalogoCocina('${itemId}')" class="btn-aviso-confirmar">Sí, eliminar</button>` +
    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
    "🗑",
    false
  );
}

async function confirmarEliminarCatalogoCocina(itemId) {
  document.getElementById("modalAvisoSimple").style.display = "none";
  try {
    await deleteDoc(doc(db, "catalogoChecklistCocina", itemId));
  } catch (e) {
    console.error("Error al eliminar del catálogo cocina:", e);
  }
}

window.confirmarEliminarCatalogoCocina = confirmarEliminarCatalogoCocina;

// ===============================
// CÁMARA — PESTAÑA Y LÓGICA
// ===============================
function renderPestanaCamara() {
  const cont = document.getElementById("checklistCocinaContenido");
  if (!cont) return;

  const itemsCamara = catalogoBaseCocina.filter((i) => i.categoria === "CAMARA");

  let html = `
    <div class="camara-header">
      <div class="camara-titulo">🧊 Stock de cámara</div>
      <div class="camara-subtitulo">Tocá + / − para ajustar el stock disponible</div>
    </div>
  `;

  if (!window.checklistCocinaSoloLectura) {
    html += `
      <div class="camara-nuevo">
        <div class="catalogo-nuevo-titulo">Agregar ítem a cámara</div>
        <div class="camara-nuevo-fila">
          <input type="text" id="camaraNuevoNombre" placeholder="Nombre (ej: LOMO, POLLO...)"
            class="catalogo-nuevo-input catalogo-nuevo-input--nombre">
          <input type="number" id="camaraNuevoStock" placeholder="Cantidad" min="0"
            class="catalogo-nuevo-input" style="max-width:90px;">
          <button type="button" class="btn-catalogo-agregar" data-action="guardar-stock-nuevo">
            + Agregar
          </button>
        </div>
      </div>
    `;
  }

  if (itemsCamara.length === 0) {
    html += `<p class="checklist-vacio">No hay ítems en cámara todavía.</p>`;
  } else {
    html += `<div class="camara-lista">`;
    itemsCamara.forEach((item) => {
      const stock = item.stock || 0;
      const stockClass = stock === 0 ? "camara-stock--vacio" : stock <= 3 ? "camara-stock--bajo" : "camara-stock--ok";
      html += `
        <div class="camara-item">
          <div class="camara-item-nombre">${item.nombre}</div>
          <div class="camara-item-controles">
            <button type="button" class="btn-stock btn-stock--restar" data-action="restar-stock" data-id="${item.id}">−</button>
            <input type="number" class="camara-stock ${stockClass}"
              data-action="editar-stock-directo" data-id="${item.id}"
              value="${stock}" min="0">
            <button type="button" class="btn-stock btn-stock--sumar" data-action="sumar-stock" data-id="${item.id}">+</button>
          </div>
          ${!window.checklistCocinaSoloLectura ? `
          <button type="button" class="btn-catalogo-eliminar"
            data-action="eliminar-catalogo-cocina" data-id="${item.id}">🗑</button>` : ""}
        </div>
      `;
    });
    html += `</div>`;
  }

  cont.innerHTML = html;
}

async function ajustarStockDirecto(itemId, nuevoStock) {
  try {
    await updateDoc(doc(db, "catalogoChecklistCocina", itemId), { stock: nuevoStock });
  } catch (e) {
    console.error("Error al editar stock directo:", e);
  }
}

async function ajustarStock(itemId, delta) {
  const item = catalogoBaseCocina.find((i) => i.id === itemId);
  if (!item) return;

  const nuevoStock = Math.max(0, (item.stock || 0) + delta);
  try {
    await updateDoc(doc(db, "catalogoChecklistCocina", itemId), { stock: nuevoStock });
    // La actualización llega por onSnapshot y re-renderiza automáticamente
  } catch (e) {
    console.error("Error al ajustar stock:", e);
  }
}

async function agregarDesdeCamera(itemId, nombre, categoria, cantidad) {
  await agregarChecklistCocinaItem(nombre, categoria, cantidad);
}

async function guardarItemCamaraDesdeForm() {
  const nombreEl = document.getElementById("camaraNuevoNombre");
  const stockEl = document.getElementById("camaraNuevoStock");

  const nombre = nombreEl?.value.trim().toUpperCase();
  const stock = Number(stockEl?.value) || 0;

  if (!nombre) {
    window.mostrarAvisoSimple("Faltan datos", "Escribí el nombre del ítem.", "⚠️");
    return;
  }

  const yaExiste = catalogoBaseCocina.some(
    (i) => i.nombre.toLowerCase() === nombre.toLowerCase() && i.categoria === "CAMARA"
  );
  if (yaExiste) {
    window.mostrarAvisoSimple("Ítem duplicado", `<strong>${nombre}</strong> ya existe en cámara.`, "⚠️");
    return;
  }

  try {
    await addDoc(collection(db, "catalogoChecklistCocina"), {
      nombre,
      categoria: "CAMARA",
      stock,
    });
    if (nombreEl) nombreEl.value = "";
    if (stockEl) stockEl.value = "";
  } catch (e) {
    console.error("Error al agregar ítem a cámara:", e);
  }
}

// ===============================
// CHECKLIST COCINA — PDF
// ===============================
window.generarPDFChecklistCocina = function () {
  const evento = window.eventoChecklistCocinaActual;
  if (!evento) return;

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const checklist = evento.checklistCocina || [];
  const total = checklist.length;
  const preparados = checklist.filter((i) => i.preparado).length;

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("JOOLI Catering", 105, 20, { align: "center" });

  pdf.setFontSize(13);
  pdf.setFont("helvetica", "normal");
  pdf.text("Checklist de cocina", 105, 28, { align: "center" });

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  const fecha = evento.date
    ? new Date(evento.date + "T00:00:00").toLocaleDateString("es-AR")
    : "";
  pdf.text(`${evento.client || ""}  ·  ${fecha}`, 105, 38, { align: "center" });

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
    const grupos = agruparPorCategoria(checklist);
    let y = 60;

    Object.entries(grupos).forEach(([categoria, items]) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(22, 160, 133);
      pdf.text(categoria, 14, y);
      y += 6;
      pdf.setTextColor(0, 0, 0);

      items.forEach((item) => {
        if (y > 275) { pdf.addPage(); y = 20; }
        pdf.setDrawColor(150, 150, 150);
        pdf.setLineWidth(0.3);
        pdf.rect(14, y - 4, 5, 5);
        if (item.preparado) {
          pdf.setDrawColor(39, 174, 96);
          pdf.setLineWidth(0.8);
          pdf.line(15, y - 1.5, 16.5, y);
          pdf.line(16.5, y, 18.5, y - 3.5);
        }
        pdf.setFont("helvetica", item.preparado ? "italic" : "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(item.preparado ? 150 : 0, item.preparado ? 150 : 0, item.preparado ? 150 : 0);
        pdf.text(`${item.nombre}`, 22, y);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(`x${item.cantidad || 1}`, 180, y, { align: "right" });
        pdf.setTextColor(0, 0, 0);
        y += 8;
      });
      y += 4;
    });
  }

  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generado por JOOLI CateringDesk · ${new Date().toLocaleDateString("es-AR")}`, 105, 290, { align: "center" });

  const pdfBlob = pdf.output("blob");
  const url = URL.createObjectURL(pdfBlob);
  window.open(url, "_blank");
};

// ===============================
// INIT COCINA
// ===============================
export function initListaCocina() {
  initCatalogoCocinaDelegate();
  initChecklistCocinaDelegate();
  initControlesCocinaDelegate();
  cargarCatalogoCocina();
}

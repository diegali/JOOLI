let selectedCard = null;

export function initUI() {
  document.getElementById("addBtn").style.display = "inline-block";
  document.getElementById("updateBtn").style.display = "none";
}

export function highlightCard(id) {

  const cards = document.querySelectorAll("#eventsList .card");

  cards.forEach(card => {

    if (card.dataset.id === id) {

      if (selectedCard) selectedCard.classList.remove("selected");

      card.classList.add("selected");
      selectedCard = card;

      card.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

    }

  });

}

// ===============================
// AVISO / MODAL SIMPLE (compartido)
// ===============================
export function mostrarAviso(titulo, mensaje, icono = "⚠️", mostrarBoton = true) {
  const modal = document.getElementById("modalAvisoSimple");
  const tituloEl = document.getElementById("modalAvisoTitulo");
  const mensajeEl = document.getElementById("modalAvisoMensaje");
  const iconoEl = document.getElementById("modalAvisoIcono");
  const btnEntendido = document.getElementById("btnCerrarAvisoSimple");

  if (!modal || !tituloEl || !mensajeEl || !iconoEl) return;

  tituloEl.textContent = titulo;
  mensajeEl.innerHTML = mensaje;
  iconoEl.textContent = icono;
  if (btnEntendido) btnEntendido.style.display = mostrarBoton ? "inline-block" : "none";
  modal.style.display = "flex";
  pushModalHistory(() => { modal.style.display = "none"; });
}

window.mostrarAvisoSimple = mostrarAviso;
window.mostrarAvisoStaff = mostrarAviso;

// ===============================
// HISTORIAL — BOTÓN ATRÁS DEL CELU
// ===============================

const _modalStack = [];

export function pushModalHistory(cerrarFn) {
  history.pushState({ modal: true }, "");
  _modalStack.push(cerrarFn);
}

export function popModalHistory() {
  if (_modalStack.length > 0) {
    _modalStack.pop();
  }
}

window.addEventListener("popstate", () => {
  if (_modalStack.length > 0) {
    const cerrar = _modalStack.pop();
    cerrar();
    // Si después del cierre el detalle volvió a abrirse, ya habrá pusheado solo
  } else {
    // Stack vacío pero el navegador retrocedió — volver a pushear para no salir
    if (document.getElementById("modalDetalleEvento")?.style.display === "flex") {
      history.pushState({ modal: true }, "");
      _modalStack.push(window.cerrarModalDetalle);
    }
  }
});
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
}

window.mostrarAvisoSimple = mostrarAviso;
window.mostrarAvisoStaff = mostrarAviso;
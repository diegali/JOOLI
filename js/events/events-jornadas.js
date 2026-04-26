// js/events/events-jornadas.js

export function initJornadas() {

  window.toggleMultidia = function () {
    const checked = document.getElementById("esMultidia")?.checked;
    const seccionUnDia = document.getElementById("seccionUnDia");
    const jornadasCont = document.getElementById("jornadasContainer");

    if (seccionUnDia) seccionUnDia.style.display = checked ? "none" : "block";
    if (jornadasCont) jornadasCont.style.display = checked ? "block" : "none";

    if (checked) {
      window._jornadasActuales = [];
      window.agregarJornada();
    } else {
      window._jornadasActuales = [];
      document.getElementById("jornadasLista").innerHTML = "";
    }
  };

  window.agregarJornada = function () {
    if (!window._jornadasActuales) window._jornadasActuales = [];

    const anterior = window._jornadasActuales.length > 0
      ? window._jornadasActuales[window._jornadasActuales.length - 1]
      : null;

    const nueva = anterior ? {
      fecha: anterior.fecha || "",
      tipo: anterior.tipo || "Catering Completo",
      lugar: anterior.lugar || "",
      invitados: anterior.invitados || "",
      staffNecesario: anterior.staffNecesario || "",
      horaInicio: anterior.horaInicio || "",
      horaFin: anterior.horaFin || "",
      horaPresentacion: anterior.horaPresentacion || "",
      alquileres: { ...anterior.alquileres } || {},
      notas: anterior.notas || "",
      mensajesEnviados: [],
      checklist: [],
    } : {
      fecha: document.getElementById("date")?.value || "",
      tipo: "Catering Completo",
      lugar: "",
      invitados: "",
      staffNecesario: "",
      horaInicio: "",
      horaFin: "",
      horaPresentacion: "",
      alquileres: {},
      notas: "",
      mensajesEnviados: [],
      checklist: [],
    };

    window._jornadasActuales.push(nueva);
    window.renderJornadas();
  };

  window.eliminarJornada = function (index) {
    window._jornadasActuales.splice(index, 1);

    if (window._jornadasActuales.length === 0) {
      const esMultidia = document.getElementById("esMultidia");
      const seccionUnDia = document.getElementById("seccionUnDia");
      const jornadasCont = document.getElementById("jornadasContainer");

      if (esMultidia) esMultidia.checked = false;
      if (seccionUnDia) seccionUnDia.style.display = "block";
      if (jornadasCont) jornadasCont.style.display = "none";
    }

    window.renderJornadas();
  };

  window.actualizarJornada = function (index, campo, valor) {
    if (!window._jornadasActuales?.[index]) return;

    if (campo === "fecha") {
      const fechaEvento = document.getElementById("date")?.value;

      if (fechaEvento && valor < fechaEvento) {
        window.mostrarAvisoSimple(
          "Fecha inválida",
          "La fecha de la jornada no puede ser anterior a la fecha del evento.",
          "⚠️"
        );
        window.renderJornadas();
        return;
      }

      if (index > 0) {
        const fechaAnterior = window._jornadasActuales[index - 1].fecha;
        if (fechaAnterior && valor < fechaAnterior) {
          window.mostrarAvisoSimple(
            "Fecha inválida",
            `La fecha de la jornada ${index + 1} no puede ser anterior a la jornada ${index}.`,
            "⚠️"
          );
          window.renderJornadas();
          return;
        }
      }
    }

    window._jornadasActuales[index][campo] = valor;
    // Calcular mozos automáticamente al cambiar invitados
    if (campo === "invitados") {
      const cantidad = Number(valor) || 0;
      if (!window._jornadasActuales[index]._mozosEditados) {
        const calculado = cantidad > 0 ? Math.ceil(cantidad / 10) : "";
        window._jornadasActuales[index].staffNecesario = calculado;
        // Actualizar el input de mozos directamente sin re-renderizar
        const jornadaCards = document.querySelectorAll(".jornada-card");
        const mozosInput = jornadaCards[index]?.querySelector(".jornada-mozos input");
        if (mozosInput) mozosInput.value = calculado;
      }
    }

    // Marcar mozos como editados manualmente
    if (campo === "staffNecesario" && valor !== "") {
      window._jornadasActuales[index]._mozosEditados = true;
    }
    // Sincronizar fecha del evento con la primera jornada
    if (campo === "fecha" && index === 0) {
      const dateEl = document.getElementById("date");
      if (dateEl) dateEl.value = valor;
    }
  };

  window.copiarStaffJornada = function (index) {
    const anterior = window._jornadasActuales[index - 1];
    if (!anterior?.mensajesEnviados?.length) return;
    window._jornadasActuales[index].mensajesEnviados = anterior.mensajesEnviados.map(m => ({ ...m }));
    window.renderJornadas();
  };

  window.actualizarAlquilerJornada = function (index, campo, valor) {
    if (!window._jornadasActuales?.[index]) return;
    if (!window._jornadasActuales[index].alquileres) {
      window._jornadasActuales[index].alquileres = {};
    }
    window._jornadasActuales[index].alquileres[campo] = valor;
  };

  window.renderJornadas = function () {
    const lista = document.getElementById("jornadasLista");
    if (!lista) return;

    if (!window._jornadasActuales || window._jornadasActuales.length === 0) {
      lista.innerHTML = "<p class='jornada-vacia'>No hay jornadas cargadas.</p>";
      return;
    }

    lista.innerHTML = window._jornadasActuales.map((j, i) => `
      <div class="jornada-card">
        <div class="jornada-card-header">
          <span class="jornada-numero">
            Jornada ${i + 1}
            ${j.fecha ? ` · ${new Date(j.fecha + "T00:00:00").toLocaleDateString("es-AR")}` : ""}
            ${j.tipo ? ` · ${j.tipo}` : ""}
            ${j.horaInicio ? ` · ${j.horaInicio}` : ""}
          </span>
          <button type="button" onclick="window.eliminarJornada(${i})" class="btn-catalogo-eliminar">🗑</button>
        </div>

        <div class="jornada-grid">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" value="${j.fecha}" onchange="window.actualizarJornada(${i}, 'fecha', this.value)">
          </div>
          <div class="form-group">
            <label>Hora inicio</label>
            <input type="time" value="${j.horaInicio || ""}" onchange="window.actualizarJornada(${i}, 'horaInicio', this.value)">
          </div>
          <div class="form-group">
            <label>Hora fin</label>
            <input type="time" value="${j.horaFin || ""}" onchange="window.actualizarJornada(${i}, 'horaFin', this.value)">
          </div>
          <div class="form-group">
            <label>Presentación</label>
            <input type="time" value="${j.horaPresentacion || ""}" onchange="window.actualizarJornada(${i}, 'horaPresentacion', this.value)">
          </div>
        </div>

        <div class="jornada-row-tipo">
          <div class="form-group jornada-tipo">
            <label>Tipo</label>
            <select onchange="window.actualizarJornada(${i}, 'tipo', this.value)">
              ${["Catering Completo", "Coffee", "Almuerzo/Cena informal", "Almuerzo/Cena formal", "Asado", "Cumpleaños", "Cumpleaños de 15"]
        .map(t => `<option ${j.tipo === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="form-group jornada-invitados">
            <label>Invitados</label>
            <input type="number" value="${j.invitados || ""}" oninput="window.actualizarJornada(${i}, 'invitados', this.value)">
          </div>
        </div>

        <div class="jornada-row-lugar">
          <div class="form-group jornada-mozos">
            <label>Mozos</label>
            <input type="number" value="${j.staffNecesario || ""}" onchange="window.actualizarJornada(${i}, 'staffNecesario', this.value)">
          </div>
          <div class="form-group jornada-lugar">
            <label>Lugar</label>
            <div class="place-input-wrap">
              <input type="text" id="jornadaLugar_${i}" value="${j.lugar || ""}"
                onchange="window.actualizarJornada(${i}, 'lugar', this.value)">
              <button type="button" onclick="window.abrirModalMapsJornada(${i})" class="btn-ubicar">📍</button>
            </div>
          </div>
        </div>

        <div class="form-group form-alquileres">
          <label>Alquileres</label>
          <div class="alquileres-grid">
            <label class="alquiler-label">
              <input type="checkbox" ${j.alquileres?.vajilla ? "checked" : ""}
                onchange="window.actualizarAlquilerJornada(${i}, 'vajilla', this.checked)"> Vajilla
            </label>
            <label class="alquiler-label">
              <input type="checkbox" ${j.alquileres?.manteleria ? "checked" : ""}
                onchange="window.actualizarAlquilerJornada(${i}, 'manteleria', this.checked)"> Mantelería
            </label>
            <label class="alquiler-label">
              <input type="checkbox" ${j.alquileres?.mobiliario ? "checked" : ""}
                onchange="window.actualizarAlquilerJornada(${i}, 'mobiliario', this.checked)"> Mobiliario
            </label>
            <label class="alquiler-label">
              <input type="checkbox" ${j.alquileres?.mobiliarioTrabajo ? "checked" : ""}
                onchange="window.actualizarAlquilerJornada(${i}, 'mobiliarioTrabajo', this.checked)"> Mob. trabajo
            </label>
          </div>
          <input type="text" value="${j.alquileres?.notas || ""}" placeholder="Notas de alquiler..."
            class="alq-notas" onchange="window.actualizarAlquilerJornada(${i}, 'notas', this.value)">
        </div>

        <div class="form-group">
          <label>Notas</label>
          <textarea onchange="window.actualizarJornada(${i}, 'notas', this.value)">${j.notas || ""}</textarea>
        </div>

        <div class="jornada-acciones">
          ${i > 0 && window._jornadasActuales[i - 1]?.mensajesEnviados?.length > 0 ? `
          <button type="button" onclick="window.copiarStaffJornada(${i})" class="btn-jornada-copiar-staff">
            📋 Copiar staff jornada ${i}
          </button>` : ""}
          <button type="button" onclick="window.abrirStaffJornada(${i})" class="btn-jornada-staff">
            🤵 Staff
            ${j.mensajesEnviados?.length > 0
        ? `<span class="jornada-staff-badge">${j.mensajesEnviados.length}</span>`
        : ""}
          </button>
          <button type="button" onclick="window.abrirChecklistJornada(${i})" class="btn-jornada-checklist">
            📦 Checklist
            ${j.checklist?.length > 0
        ? `<span class="jornada-staff-badge">${j.checklist.filter(c => c.preparado).length}/${j.checklist.length}</span>`
        : ""}
          </button>
        </div>
      </div>
    `).join("");
  };

}

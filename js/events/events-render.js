// js/events/events-render.js

import { getMonthLabel, formatDate } from "./events-utils.js";
import { fillFormForEdit } from "./events-form.js";

export function renderFilteredEvents(events, deps) {
    const {
        updateStats,
        updateClientDatalist,
    } = deps;

    const eventsList = document.getElementById("eventsList");
    if (!eventsList) return;

    eventsList.innerHTML = "";

    const today = new Date().toISOString().split("T")[0];
    const estadoActivo =
        document.querySelector(".filtro-estado.active")?.dataset.estado || "";

    events = events.filter((e) => {
        const esPasado = e.date < today;
        const esCerrado = esPasado && e.paid === true;

        if (estadoActivo === "Cerrado") {
            return esCerrado;
        }

        // Por defecto los cerrados no se muestran
        if (esCerrado) return false;

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

    renderGroup(upcomingGroups, "📅 Próximos Eventos", "proximos");
    renderGroup(pastGroups, "📜 Historial", "historial");
}

function renderGroup(groups, sectionTitle, colorClass) {
    const eventsList = document.getElementById("eventsList");
    if (!eventsList) return;

    if (Object.keys(groups).length === 0) return;

    const esHistorial = colorClass === "historial";
    const abrirWrapper = esHistorial ? `<div class="eventos-historial-zona">` : "";
    const cerrarWrapper = esHistorial ? `</div>` : "";

    let html = abrirWrapper;
    html += `<h3 class="eventos-seccion-titulo eventos-seccion-titulo--${colorClass}">${sectionTitle}</h3>`;

    for (const month in groups) {
        html += `<h4 class="eventos-mes-titulo">${month}</h4>`;
        html += groups[month].join("");
    }

    html += cerrarWrapper;
    eventsList.innerHTML += html;
}

function createCard(evento, id) {
    const today = new Date().toISOString().split("T")[0];
    const esHoy = evento.date === today;

    const statusClass = `status-badge status-badge--${(evento.status || "").replace(" ", "-")}`;

    const pagadoBadge = (evento.paid === true && evento.date < today)
        ? `<span class="badge-pagado">PAGADO</span>`
        : "";

    const invoiceIndicator = evento.invoiceType === "A"
        ? `<span class="invoice-badge">FACT A</span>`
        : "";
    const checklist = evento.checklist || [];
    const checklistCompleto = checklist.length > 0 && checklist.every(item => item.preparado);
    const checklistVacio = checklist.length === 0;

    const alquileresTexto = evento.alquileres && Object.values(evento.alquileres).some(v => v === true)
        ? `<div class="event-card__alquileres">🪑 ${[
            evento.alquileres.vajilla ? "Vajilla" : null,
            evento.alquileres.manteleria ? "Mantelería" : null,
            evento.alquileres.mobiliario ? "Mobiliario" : null,
            evento.alquileres.mobiliarioTrabajo ? "Mob. trabajo" : null,
        ].filter(Boolean).join(" · ")}</div>`
        : "";

    return `
    <div onclick="window.abrirModalDetalle('${id}')" class="event-card ${esHoy ? "event-card--hoy" : ""}" data-cliente="${(evento.client || "").toLowerCase()}">
      <div class="event-card__header">
        <div>
          <div class="event-card__fecha">${formatDate(evento.date)}</div>
          <div class="event-card__cliente">${evento.client || "-"} ${invoiceIndicator}</div>
          <div class="event-card__tipo">${evento.type || "-"}</div>
        </div>
        <div class="event-card__badges">
        <div class="${statusClass}">${evento.status || "-"}</div>
        ${pagadoBadge}
        ${checklistCompleto ? `<span class="badge-checklist-ok">✔ Lista</span>` : ""}
        ${!checklistVacio && !checklistCompleto ? `<span class="badge-checklist-pendiente">📦 Pendiente</span>` : ""}
        </div>
      </div>
      <div class="event-card__body">
        📍 ${evento.place || "-"}<br>
        👥 ${evento.guests || "-"} personas<br>
        🕒 ${evento.horaInicio || "-"} a ${evento.horaFin || "-"}
      </div>
      ${alquileresTexto}
    </div>
  `;
}

export function registerEventDetailModal(deps) {
    const {
        getAllEvents,
        setEditingId,
        renderStaffSelection,
        puedeEditarPresupuesto,
    } = deps;

    window.abrirModalDetalle = async function (eventoId) {
        const evento = getAllEvents().find((ev) => ev.id === eventoId);
        if (!evento) return;

        const staff = evento.mensajesEnviados || [];
        const confirmados = staff.filter((m) => m.estado === "confirmado").length;
        const pendientes = staff.filter((m) => m.estado === "pendiente").length;
        const rechazados = staff.filter((m) => m.estado === "rechazado").length;
        const totalAsignados = confirmados + pendientes;
        const staffNecesario = Number(evento.staffNecesario || 0);
        const faltanMozos = Math.max(staffNecesario - totalAsignados, 0);

        let textoStaff = "Sin staff asignado";
        let staffColorClass = "detail-staff-danger";

        if (totalAsignados > 0 && faltanMozos === 0) {
            textoStaff = "Staff completo ✔";
            staffColorClass = "detail-staff-ok";
        } else if (totalAsignados > 0) {
            textoStaff = `Falta${faltanMozos === 1 ? "" : "n"} ${faltanMozos} mozo${faltanMozos === 1 ? "" : "s"}`;
            staffColorClass = "detail-staff-warning";
        }

        const alquileresDetalle = evento.alquileres && Object.values(evento.alquileres).some(v => v === true)
            ? `<br>🪑 <span class="event-card__alquileres">Alquileres: ${[
                evento.alquileres.vajilla ? "Vajilla" : null,
                evento.alquileres.manteleria ? "Mantelería" : null,
                evento.alquileres.mobiliario ? "Mobiliario" : null,
                evento.alquileres.mobiliarioTrabajo ? "Mob. trabajo" : null,
            ].filter(Boolean).join(" · ")}</span>
              ${evento.alquileres.notas ? `<br><span class="detail-notas-alquiler">📋 ${evento.alquileres.notas}</span>` : ""}`
            : "";

        const contenido = document.getElementById("detalleContenido");
        if (contenido) {
            contenido.innerHTML = `
              <div class="detail-header">
                <div class="detail-header__top">
                  <div class="detail-fecha">${formatDate(evento.date)}</div>
                  <span class="status-badge status-badge--${(evento.status || "").replace(" ", "-")}">${evento.status}</span>
                </div>
                <div class="detail-cliente">${evento.client}</div>
                <div class="detail-tipo">${evento.type}</div>
              </div>

              <div class="detail-row">
                📍 <strong>${evento.place || "-"}</strong>${evento.placeUrl ? ` <a href="${evento.placeUrl}" target="_blank" class="detail-maps-link">Ver en Maps</a>` : ""}<br>
                👥 <strong>${evento.guests || "-"}</strong> personas<br>
                🕒 Evento: <strong>${evento.horaInicio || "-"}</strong> a <strong>${evento.horaFin || "-"}</strong><br>
                👔 Presentación: <strong>${evento.horaPresentacion || "-"}</strong><br>
                💰 Total: <strong>$${Number(evento.total || 0).toLocaleString()}</strong>
                ${evento.paid ? `<span class="detail-cobrado-badge">COBRADO</span>` : ""}<br>
                💵 Seña: <strong>$${Number(evento.deposit || 0).toLocaleString()}</strong><br>
                👥 <span class="${staffColorClass}">${textoStaff}</span>
                <span class="detail-staff-conteo"> · ✔ ${confirmados} · ⏳ ${pendientes} · ❌ ${rechazados}</span>
                ${evento.notes ? `<br>📝 <em class="detail-notes">${evento.notes}</em>` : ""}
                ${evento.invoiceNumber ? `<br>🧾 Factura: <strong>${evento.invoiceType || ""} ${evento.invoiceNumber}</strong>` : ""}
                ${alquileresDetalle}
              </div>
            `;
        }

        const eventoPasado = evento.date < new Date().toISOString().split("T")[0];

        const editarBtn = document.getElementById("detalleEditarBtn");
        const staffBtn = document.getElementById("detalleStaffBtn");
        const checklistBtn = document.getElementById("detalleChecklistBtn");
        const presupuestoBtn = document.getElementById("detallePresupuestoBtn");

        if (editarBtn) {
            editarBtn.onclick = async () => {
                window.cerrarModalDetalle();
                await fillFormForEdit(evento, eventoId, {
                    setEditingId,
                    renderStaffSelection,
                    puedeEditarPresupuesto,
                });
            };
        }

        const duplicarBtn = document.getElementById("detalleDuplicarBtn");
        if (duplicarBtn) {
            duplicarBtn.onclick = async () => {
                window.cerrarModalDetalle();
                await fillFormForEdit(evento, eventoId, {
                    setEditingId,
                    renderStaffSelection,
                    puedeEditarPresupuesto,
                });
                // Aseguramos que placeUrl quede guardado antes de limpiar el editingId
                let placeUrlEl = document.getElementById("placeUrl");
                if (!placeUrlEl) {
                    placeUrlEl = document.createElement("input");
                    placeUrlEl.type = "hidden";
                    placeUrlEl.id = "placeUrl";
                    document.getElementById("eventFormContainer").appendChild(placeUrlEl);
                }
                placeUrlEl.value = evento.placeUrl || "";
                // Limpiar los campos que no deben duplicarse
                setEditingId(null);
                window.editingId = null;
                document.getElementById("date").value = "";
                document.getElementById("status").value = "Presupuestado";
                document.getElementById("paid").value = "false";
                document.getElementById("deposit").value = "";
                document.getElementById("invoiceNumber").value = "";

                const formTitle = document.getElementById("formTitle");
                if (formTitle) formTitle.innerText = "Nuevo Evento";
                const updateBtn = document.getElementById("updateBtn");
                const addBtn = document.getElementById("addBtn");
                const deleteBtn = document.getElementById("deleteBtn");
                if (updateBtn) updateBtn.style.display = "none";
                if (addBtn) addBtn.style.display = "inline-block";
                if (deleteBtn) deleteBtn.style.display = "none";
            };
        }

        if (staffBtn) {
            staffBtn.style.display = "";
            staffBtn.onclick = () => {
                window.cerrarModalDetalle();
                window.abrirModalGestionStaff(eventoId);
            };
        }

        if (checklistBtn) {
            checklistBtn.style.display = "";
            checklistBtn.onclick = () => {
                window.cerrarModalDetalle();
                window.abrirModalChecklist(eventoId);
            };
        }

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
}
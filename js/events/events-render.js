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
        // Para multidia usamos la fecha de la primera jornada
        const fechaRef = e.esMultidia
            ? (e.jornadas?.[0]?.fecha || "")
            : (e.date || "");

        const esPasado = fechaRef < today;
        const esCerrado = esPasado && e.paid === true;

        if (estadoActivo === "Cerrado") {
            return esCerrado;
        }

        if (esCerrado) return false;

        if (estadoActivo && e.status !== estadoActivo) return false;

        return true;
    });

    const upcomingGroups = {};
    const pastGroups = {};

    events.forEach((e) => {
        const fechaRef = e.esMultidia
            ? (e.jornadas?.[0]?.fecha || "")
            : (e.date || "");

        const monthKey = getMonthLabel(fechaRef);
        const isPast = fechaRef < today;

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
    const multidiaBadge = evento.esMultidia && evento.jornadas?.length > 0
        ? `<span class="badge-multidia">📅 ${evento.jornadas.length} jornadas</span>`
        : "";
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
            ${multidiaBadge}
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
      ${(() => {
            const hoy = new Date().toISOString().split("T")[0];
            const fechaRef = evento.esMultidia ? (evento.jornadas?.[0]?.fecha || "") : (evento.date || "");
            if (fechaRef < hoy) return "";

            let necesario = 0;
            let confirmados = 0;
            let pendientes = 0;

            if (evento.esMultidia && evento.jornadas?.length > 0) {
                evento.jornadas.forEach(j => {
                    necesario += Number(j.staffNecesario || 0);
                    confirmados += (j.mensajesEnviados || []).filter(m => m.estado === "confirmado").length;
                    pendientes += (j.mensajesEnviados || []).filter(m => m.estado === "pendiente").length;
                });
            } else {
                necesario = Number(evento.staffNecesario || 0);
                const msgs = evento.mensajesEnviados || [];
                confirmados = msgs.filter(m => m.estado === "confirmado").length;
                pendientes = msgs.filter(m => m.estado === "pendiente").length;
            }

            const activos = confirmados + pendientes;
            const faltan = Math.max(necesario - activos, 0);

            if (necesario === 0 && activos === 0) return "";

            let color = "#27ae60";
            if (activos === 0) color = "#c0392b";
            else if (faltan > 0) color = "#e67e22";

            return `<div class="event-card__staff-resumen" style="color:${color};">
    🤵 ${confirmados} conf. · ${pendientes} pend.${faltan > 0 ? ` · ${faltan} faltan` : " · completo"}
  </div>`;
        })()}
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
        window._detalleEventoAbierto = eventoId;
        const evento = getAllEvents().find((ev) => ev.id === eventoId);
        if (!evento) return;

        // Advertir si hay edición en curso
        if (window.editingId) {
            const client = document.getElementById("client")?.value;
            if (client) {
                window.mostrarAvisoSimple(
                    "¿Salir sin guardar?",
                    `Estás editando el evento de <strong>${client}</strong>. Si salís perderás los cambios.<br><br>` +
                    `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'; window.resetFormConfirmado(); window.abrirModalDetalle('${eventoId}')" class="btn-aviso-confirmar">Salir sin guardar</button>
         <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Volver a editar</button>`,
                    "⚠️", false
                );
                return;
            }
        }

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
            textoStaff = `Falta${faltanMozos === 1 ? "" : "n"} ${faltanMozos} staff`;
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
                <div class="detail-tipo">${evento.esMultidia && evento.jornadas?.length > 0
                    ? [...new Set(evento.jornadas.map(j => j.tipo).filter(Boolean))].join(" · ")
                    : evento.type || "-"
                }</div>
              </div>

              <div class="detail-row">
  ${!evento.esMultidia ? `
    📍 <strong>${evento.place || "-"}</strong>${evento.placeUrl ? ` <a href="${evento.placeUrl}" target="_blank" class="detail-maps-link">Ver en Maps</a>` : ""}<br>
    👥 <strong>${evento.guests || "-"}</strong> personas<br>
    🕒 Evento: <strong>${evento.horaInicio || "-"}</strong> a <strong>${evento.horaFin || "-"}</strong><br>
    👔 Presentación: <strong>${evento.horaPresentacion || "-"}</strong><br>
  ` : ""}
  💰 Total: <strong>$${Number(evento.total || 0).toLocaleString()}</strong>
  ${evento.paid ? `<span class="detail-cobrado-badge">COBRADO</span>` : ""}<br>
  💵 Seña: <strong>$${Number(evento.deposit || 0).toLocaleString()}</strong><br>
  ${!evento.esMultidia ? `
    <div class="detail-inline-accion">
      <div>
        🤵 <span class="${staffColorClass}">${textoStaff}</span>
        <span class="detail-staff-conteo"> · ✔ ${confirmados} · ⏳ ${pendientes} · ❌ ${rechazados}</span>
      </div>
      <button onclick="window.abrirModalGestionStaff('${eventoId}')" class="btn-detail-inline">Gestionar</button>
    </div>
    ${(() => {
                        const checklist = evento.checklist || [];
                        const total = checklist.length;
                        const preparados = checklist.filter(c => c.preparado).length;
                        if (total === 0) return `
        <div class="detail-inline-accion">
          <div>📦 Sin checklist armado</div>
          <button onclick="window.cerrarModalDetalle(); window.abrirModalChecklist('${eventoId}')" class="btn-detail-inline">Armar</button>
        </div>`;
                        const color = preparados === total ? "#27ae60" : preparados === 0 ? "#c0392b" : "#e67e22";
                        return `
        <div class="detail-inline-accion">
          <div>📦 <span style="color:${color}; font-weight:600;">${preparados}/${total} ítems preparados</span></div>
          <button onclick="window.abrirModalChecklist('${eventoId}')" class="btn-detail-inline">Ver</button>
        </div>`;
                    })()}
  ` : ""}
  ${!evento.esMultidia ? `
    ${(() => {
                        const checklist = evento.checklist || [];
                        const total = checklist.length;
                        const preparados = checklist.filter(c => c.preparado).length;
                        if (total === 0) return "";
                        const color = preparados === total ? "#27ae60" : preparados === 0 ? "#c0392b" : "#e67e22";
                        return `📦 <span style="color:${color}; font-weight:600;">${preparados}/${total} ítems preparados</span><br>`;
                    })()}
  ` : ""}
  ${evento.notes ? `📝 <em class="detail-notes">${evento.notes}</em><br>` : ""}
  ${evento.presupuestoURL ? `📄 Presupuesto: <a href="${evento.presupuestoURL}" target="_blank" class="detail-maps-link">Ver</a><br>` : ""}
  ${evento.invoiceNumber ? `🧾 Factura: <strong>${evento.invoiceType || ""} ${evento.invoiceNumber}</strong>${evento.facturaURL ? ` <a href="${evento.facturaURL}" target="_blank" class="detail-maps-link">Ver</a>` : ""}<br>` : ""}
  ${alquileresDetalle}
  ${evento.esMultidia && evento.jornadas?.length > 0 ? `
    <div class="detail-jornadas">
      <div class="detail-jornadas-titulo">📅 Jornadas</div>
      ${evento.jornadas.map((j, i) => {
                        const fecha = j.fecha ? new Date(j.fecha + "T00:00:00").toLocaleDateString("es-AR") : `Jornada ${i + 1}`;
                        const totalCheck = j.checklist?.length || 0;
                        const preparados = j.checklist?.filter(c => c.preparado).length || 0;
                        const staffAsig = j.mensajesEnviados?.length || 0;
                        const confirmados = j.mensajesEnviados?.filter(m => m.estado === "confirmado").length || 0;
                        return `
          <div class="detail-jornada-item">
            <div class="detail-jornada-fecha">${fecha}</div>
            <div class="detail-jornada-info">
              🍽 ${j.tipo || "-"}<br>
              📍 ${j.lugar || "-"}<br>
              ${j.invitados ? `👥 <strong>${j.invitados}</strong> personas<br>` : ""}
              🕒 ${j.horaInicio || "-"} a ${j.horaFin || "-"}
              ${j.horaPresentacion ? `<br>👔 Presentación: ${j.horaPresentacion}` : ""}
              <div class="detail-inline-accion">
  <div>
    ${(() => {
                                const necesario = Number(j.staffNecesario || 0);
                                const pendientesJ = j.mensajesEnviados?.filter(m => m.estado === "pendiente").length || 0;
                                const rechazadosJ = j.mensajesEnviados?.filter(m => m.estado === "rechazado").length || 0;
                                const activos = confirmados + pendientesJ;
                                const faltan = Math.max(necesario - activos, 0);
                                let textoJ = "Sin staff asignado";
                                let colorJ = "detail-staff-danger";
                                if (activos > 0 && faltan === 0) { textoJ = "Staff completo ✔"; colorJ = "detail-staff-ok"; }
                                else if (activos > 0 && faltan === 1) { textoJ = "Falta 1 staff"; colorJ = "detail-staff-warning"; }
                                else if (activos > 0) { textoJ = `Faltan ${faltan} staff`; colorJ = "detail-staff-warning"; }
                                return staffAsig > 0 || necesario > 0
                                    ? `🤵 <span class="${colorJ}">${textoJ}</span> <span class="detail-staff-conteo">· ✔ ${confirmados} · ⏳ ${pendientesJ} · ❌ ${rechazadosJ}</span>`
                                    : "🤵 Sin staff asignado";
                            })()}
  </div>
  <button onclick="window._modoStaffJornada=true; document.getElementById('modalGestionStaff').dataset.jornadaIdx=${i}; window.abrirModalGestionStaff('${eventoId}')" class="btn-detail-inline">Gestionar</button>
</div>
<div class="detail-inline-accion">
  <div>
    ${(() => {
                                const total = j.checklist?.length || 0;
                                const preparados = j.checklist?.filter(c => c.preparado).length || 0;
                                if (total === 0) return "📦 Sin checklist armado";
                                const color = preparados === total ? "#27ae60" : preparados === 0 ? "#c0392b" : "#e67e22";
                                return `📦 <span style="color:${color}; font-weight:600;">${preparados}/${total} ítems preparados</span>`;
                            })()}
  </div>
  <button onclick="window.abrirChecklistJornada(${i}, '${eventoId}')" class="btn-detail-inline">Ver</button>
</div>
                            ${totalCheck > 0 ? `<br>📦 ${preparados}/${totalCheck} ítems preparados` : ""}
                            ${j.alquileres && Object.values(j.alquileres).some(v => v === true) ? `
  <br>🪑 <span class="event-card__alquileres">Alquileres: ${[
                                    j.alquileres.vajilla ? "Vajilla" : null,
                                    j.alquileres.manteleria ? "Mantelería" : null,
                                    j.alquileres.mobiliario ? "Mobiliario" : null,
                                    j.alquileres.mobiliarioTrabajo ? "Mob. trabajo" : null,
                                ].filter(Boolean).join(" · ")}</span>
  ${j.alquileres.notas ? `<br><span class="detail-notas-alquiler">📋 ${j.alquileres.notas}</span>` : ""}
` : ""}
              ${j.notas ? `<br>📝 <em>${j.notas}</em>` : ""}
            </div>
          </div>
        `;
                    }).join("")}
    </div>
  ` : ""}
</div>
            `;
        }

        const eventoPasado = evento.date < new Date().toISOString().split("T")[0];

        const editarBtn = document.getElementById("detalleEditarBtn");
        const staffBtn = document.getElementById("detalleStaffBtn");
        const checklistBtn = document.getElementById("detalleChecklistBtn");
        const presupuestoBtn = document.getElementById("detallePresupuestoBtn");
        const eliminarBtn = document.getElementById("detalleEliminarBtn");
        if (eliminarBtn) {
            eliminarBtn.onclick = () => {
                window.cerrarModalDetalle();
                window.mostrarAvisoSimple(
                    "¿Eliminar evento?",
                    `¿Seguro que querés eliminar el evento de <strong>${evento.client}</strong>? Esta acción no se puede deshacer.<br><br>` +
                    `<button onclick="window.confirmarEliminarEvento()" class="btn-aviso-confirmar">Sí, eliminar</button>
             <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Cancelar</button>`,
                    "🗑", false
                );
                // Guardar el id para que confirmarEliminarEvento sepa cuál eliminar
                window._eventoAEliminar = eventoId;
            };
        }

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

        if (staffBtn) staffBtn.style.display = "none";
        if (checklistBtn) checklistBtn.style.display = "none";

        if (presupuestoBtn) presupuestoBtn.style.display = "none";

        document.getElementById("modalDetalleEvento").style.display = "flex";
    };

    window.cerrarModalDetalle = function () {
        window._detalleEventoAbierto = null;
        document.getElementById("modalDetalleEvento").style.display = "none";
    };
}
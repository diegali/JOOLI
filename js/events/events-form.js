// js/events/events-form.js
import { actualizarUIFactura, actualizarUIAlquiler } from "./events-budget.js";

export function resetForm({ setEditingId, actualizarUIBudget }) {
    setEditingId(null);

    const form = document.getElementById("eventFormContainer");

    if (form) {
        form.style.display = "none";

        form.querySelectorAll("input, select, textarea").forEach((el) => {
            if (!["type", "status", "paid", "invoiceType"].includes(el.id)) {
                el.value = "";
            }
            if (el.type === "checkbox") {
                el.checked = false;
            }
        });

        actualizarUIBudget(null);
    }

    const formTitle = document.getElementById("formTitle");
    const updateBtn = document.getElementById("updateBtn");
    const addBtn = document.getElementById("addBtn");
    const deleteBtn = document.getElementById("deleteBtn");

    if (formTitle) formTitle.innerText = "Nuevo Evento";
    if (updateBtn) updateBtn.style.display = "none";
    if (addBtn) addBtn.style.display = "inline-block";
    if (deleteBtn) deleteBtn.style.display = "none";

    ["btnGestionarStaff", "btnGestionarChecklist", "btnSubirPresupuesto", "btnEliminarPresupuesto"].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.style.display = "";
    });

    // Reset jornadas
    window._jornadasActuales = [];
    const jornadasContainer = document.getElementById("jornadasContainer");
    const seccionUnDia = document.getElementById("seccionUnDia");
    const esMultidia = document.getElementById("esMultidia");
    const jornadasLista = document.getElementById("jornadasLista");

    if (jornadasContainer) jornadasContainer.style.display = "none";
    if (seccionUnDia) seccionUnDia.style.display = "block";
    if (esMultidia) esMultidia.checked = false;
    if (jornadasLista) jornadasLista.innerHTML = "";
}

export function getFormData() {
    const selectedStaff = Array.from(
        document.querySelectorAll('input[name="staffSelected"]:checked')
    ).map((cb) => cb.value);

    const esMultidiaChecked = document.getElementById("esMultidia")?.checked || false;

    return {
        invoiceType: document.getElementById("invoiceType")?.value || "B/C",
        client: document.getElementById("client")?.value || "",
        cuit: document.getElementById("cuit")?.value || "",
        total: document.getElementById("total")?.value || "",
        deposit: document.getElementById("deposit")?.value || "",
        status: document.getElementById("status")?.value || "",
        paid: document.getElementById("paid")?.value === "true",
        invoiceNumber: document.getElementById("invoiceNumber")?.value || "",
        esMultidia: esMultidiaChecked,
        jornadas: window._jornadasActuales || [],
        staffAsignado: selectedStaff,

        // Campos que solo aplican a eventos de un día
        ...(esMultidiaChecked ? {} : {
            date: document.getElementById("date")?.value || "",
            type: document.getElementById("type")?.value || "",
            place: document.getElementById("place")?.value || "",
            horaInicio: document.getElementById("horaInicio")?.value || "",
            horaFin: document.getElementById("horaFin")?.value || "",
            guests: document.getElementById("guests")?.value || "",
            staffNecesario: document.getElementById("staffNecesario")?.value ||
                Math.ceil((document.getElementById("guests")?.value || 0) / 15),
            notes: document.getElementById("notes")?.value || "",
            placeUrl: document.getElementById("placeUrl")?.value || "",
            alquileres: {
                vajilla: document.getElementById("alqVajilla")?.checked || false,
                manteleria: document.getElementById("alqManteleria")?.checked || false,
                mobiliario: document.getElementById("alqMobiliario")?.checked || false,
                mobiliarioTrabajo: document.getElementById("alqMobiliarioTrabajo")?.checked || false,
                notas: document.getElementById("alqNotas")?.value || "",
            },
        }),
    };
}

export async function fillFormForEdit(evento, id, deps) {
    const {
        setEditingId,
        renderStaffSelection,
        puedeEditarPresupuesto,
    } = deps;

    setEditingId(id);
    window.editingId = id;

    // Campos generales (siempre presentes)
    const camposGenerales = [
        "client", "cuit", "total", "deposit",
        "status", "invoiceNumber", "invoiceType",
    ];

    camposGenerales.forEach((field) => {
        const el = document.getElementById(field);
        if (el) {
            el.value = evento[field] || (field === "invoiceType" ? "B/C" : "");
        }
    });

    const paidEl = document.getElementById("paid");
    if (paidEl) paidEl.value = evento.paid ? "true" : "false";

    // Campos de un solo día
    // Para multidia, sincronizar date con la primera jornada
    if (evento.esMultidia && evento.jornadas?.length > 0) {
        const dateEl = document.getElementById("date");
        if (dateEl) dateEl.value = evento.jornadas[0].fecha || "";
    }
    if (!evento.esMultidia) {
        ["date", "type", "place", "horaInicio", "horaFin",
            "guests", "staffNecesario", "notes", "placeUrl"].forEach(field => {
                const el = document.getElementById(field);
                if (el) el.value = evento[field] || "";
            });
        mostrarNombreDia(evento.date || "");

        const alq = evento.alquileres || {};
        const alqVajilla = document.getElementById("alqVajilla");
        const alqManteleria = document.getElementById("alqManteleria");
        const alqMobiliario = document.getElementById("alqMobiliario");
        const alqMobiliarioTrabajo = document.getElementById("alqMobiliarioTrabajo");
        const alqNotas = document.getElementById("alqNotas");

        if (alqVajilla) alqVajilla.checked = alq.vajilla || false;
        if (alqManteleria) alqManteleria.checked = alq.manteleria || false;
        if (alqMobiliario) alqMobiliario.checked = alq.mobiliario || false;
        if (alqMobiliarioTrabajo) alqMobiliarioTrabajo.checked = alq.mobiliarioTrabajo || false;
        if (alqNotas) alqNotas.value = alq.notas || "";
    }

    // Mostrar/ocultar secciones según multidia
    const esMultidiaEl = document.getElementById("esMultidia");
    const seccionUnDia = document.getElementById("seccionUnDia");
    const jornadasCont = document.getElementById("jornadasContainer");

    if (esMultidiaEl) esMultidiaEl.checked = evento.esMultidia || false;
    if (seccionUnDia) seccionUnDia.style.display = evento.esMultidia ? "none" : "block";
    if (jornadasCont) jornadasCont.style.display = evento.esMultidia ? "block" : "none";

    // Jornadas
    window._jornadasActuales = evento.jornadas ? [...evento.jornadas] : [];
    if (evento.esMultidia) window.renderJornadas();

    await renderStaffSelection();

    if (evento.staffAsignado) {
        evento.staffAsignado.forEach((idMozo) => {
            const checkbox = document.querySelector(`input[value="${idMozo}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    const formTitle = document.getElementById("formTitle");
    const updateBtn = document.getElementById("updateBtn");
    const addBtn = document.getElementById("addBtn");
    const deleteBtn = document.getElementById("deleteBtn");
    const form = document.getElementById("eventFormContainer");

    if (formTitle) formTitle.innerText = "Editando Evento";
    if (updateBtn) updateBtn.style.display = "inline-block";
    if (addBtn) addBtn.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "inline-block";

    if (form) {
        form.style.display = "block";
        form.scrollIntoView({ behavior: "smooth" });
    }

    const today = new Date().toISOString().split("T")[0];
    const fechaRef = evento.esMultidia
        ? (evento.jornadas?.[evento.jornadas.length - 1]?.fecha || "")
        : (evento.date || "");
    const eventoPasado = fechaRef < today;

    const puedeEditar = puedeEditarPresupuesto();

    // Presupuesto
    const verBtn = document.getElementById("btnVerPresupuesto");
    const eliminarBtn = document.getElementById("btnEliminarPresupuesto");
    const subirBtn = document.getElementById("btnSubirPresupuesto");
    const infoEl = document.getElementById("presupuestoInfo");

    if (infoEl) {
        infoEl.textContent = evento.presupuestoNombre
            ? `Archivo: ${evento.presupuestoNombre}`
            : "No hay presupuesto adjunto.";
    }
    if (subirBtn) subirBtn.style.display = puedeEditar ? "inline-block" : "none";
    if (verBtn) verBtn.style.display = evento.presupuestoURL ? "inline-block" : "none";
    if (eliminarBtn) eliminarBtn.style.display = puedeEditar && evento.presupuestoURL ? "inline-block" : "none";
    if (verBtn && evento.presupuestoURL) {
        verBtn.onclick = () => window.open(evento.presupuestoURL, "_blank");
    }

    // Factura
    const verFacturaBtn = document.getElementById("btnVerFactura");
    const eliminarFacturaBtn = document.getElementById("btnEliminarFactura");
    const subirFacturaBtn = document.getElementById("btnSubirFactura");
    const facturaInfoEl = document.getElementById("facturaInfo");

    if (facturaInfoEl) {
        facturaInfoEl.textContent = evento.facturaNombre
            ? `Archivo: ${evento.facturaNombre}`
            : "No hay factura adjunta.";
    }
    if (subirFacturaBtn) subirFacturaBtn.style.display = puedeEditar ? "inline-block" : "none";
    if (verFacturaBtn) verFacturaBtn.style.display = evento.facturaURL ? "inline-block" : "none";
    if (eliminarFacturaBtn) eliminarFacturaBtn.style.display = puedeEditar && evento.facturaURL ? "inline-block" : "none";
    if (verFacturaBtn && evento.facturaURL) {
        verFacturaBtn.onclick = () => window.open(evento.facturaURL, "_blank");
    }

    // Alquileres
    const verAlquilerBtn = document.getElementById("btnVerAlquiler");
    const eliminarAlquilerBtn = document.getElementById("btnEliminarAlquiler");
    const subirAlquilerBtn = document.getElementById("btnSubirAlquiler");
    const alquilerInfoEl = document.getElementById("alquilerInfo");

    if (alquilerInfoEl) {
        alquilerInfoEl.textContent = evento.alquilerNombre
            ? `Archivo: ${evento.alquilerNombre}`
            : "No hay archivo adjunto.";
    }
    if (subirAlquilerBtn) subirAlquilerBtn.style.display = puedeEditar ? "inline-block" : "none";
    if (verAlquilerBtn) verAlquilerBtn.style.display = evento.alquilerURL ? "inline-block" : "none";
    if (eliminarAlquilerBtn) eliminarAlquilerBtn.style.display = puedeEditar && evento.alquilerURL ? "inline-block" : "none";
    if (verAlquilerBtn && evento.alquilerURL) {
        verAlquilerBtn.onclick = () => window.open(evento.alquilerURL, "_blank");
    }

    // Si el evento pasó, ocultar botones de subir/eliminar archivos
    if (eventoPasado) {
        if (subirBtn) subirBtn.style.display = "none";
        if (eliminarBtn) eliminarBtn.style.display = "none";
        if (subirFacturaBtn) subirFacturaBtn.style.display = "none";
        if (eliminarFacturaBtn) eliminarFacturaBtn.style.display = "none";
        if (subirAlquilerBtn) subirAlquilerBtn.style.display = "none";
        if (eliminarAlquilerBtn) eliminarAlquilerBtn.style.display = "none";
    }

    // Staff y checklist
    const btnStaff = document.getElementById("btnGestionarStaff");
    const btnChecklist = document.getElementById("btnGestionarChecklist");
    if (btnStaff) btnStaff.style.display = "";
    if (btnChecklist) btnChecklist.style.display = "";

    // Resetear panel de selección de staff
    const panelSeleccion = document.getElementById("contenedorSeleccionStaff");
    const btnAbrirSeleccion = document.getElementById("btnAbrirSeleccion");
    if (panelSeleccion) panelSeleccion.style.display = "none";
    if (btnAbrirSeleccion) {
        btnAbrirSeleccion.innerText = "+ Agregar";
        btnAbrirSeleccion.disabled = false;
        btnAbrirSeleccion.classList.remove("completo");
    }

    // placeUrl como campo oculto
    let placeUrlEl = document.getElementById("placeUrl");
    if (!placeUrlEl) {
        placeUrlEl = document.createElement("input");
        placeUrlEl.type = "hidden";
        placeUrlEl.id = "placeUrl";
        document.getElementById("eventFormContainer").appendChild(placeUrlEl);
    }
    placeUrlEl.value = evento.placeUrl || "";
}

export function mostrarNombreDia(valor) {
    const el = document.getElementById("nombreDia");
    if (!el) return;
    if (!valor) { el.textContent = ""; return; }

    const [anio, mes, dia] = valor.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    const nombre = fecha.toLocaleDateString("es-AR", { weekday: "long" });
    el.textContent = "— " + nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

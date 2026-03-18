// js/events/events-form.js

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
}

export function getFormData() {
    const selectedStaff = Array.from(
        document.querySelectorAll('input[name="staffSelected"]:checked')
    ).map((cb) => cb.value);

    return {
        invoiceType: document.getElementById("invoiceType")?.value || "B/C",
        date: document.getElementById("date")?.value || "",
        type: document.getElementById("type")?.value || "",
        client: document.getElementById("client")?.value || "",
        cuit: document.getElementById("cuit")?.value || "",
        place: document.getElementById("place")?.value || "",
        horaInicio: document.getElementById("horaInicio")?.value || "",
        horaFin: document.getElementById("horaFin")?.value || "",
        guests: document.getElementById("guests")?.value || "",
        staffNecesario:
            document.getElementById("staffNecesario")?.value ||
            Math.ceil((document.getElementById("guests")?.value || 0) / 15),
        total: document.getElementById("total")?.value || "",
        deposit: document.getElementById("deposit")?.value || "",
        status: document.getElementById("status")?.value || "",
        paid: document.getElementById("paid")?.value === "true",
        invoiceNumber: document.getElementById("invoiceNumber")?.value || "",
        notes: document.getElementById("notes")?.value || "",
        placeUrl: document.getElementById("placeUrl")?.value || "",
        alquileres: {
            vajilla: document.getElementById("alqVajilla")?.checked || false,
            manteleria: document.getElementById("alqManteleria")?.checked || false,
            mobiliario: document.getElementById("alqMobiliario")?.checked || false,
            mobiliarioTrabajo:
                document.getElementById("alqMobiliarioTrabajo")?.checked || false,
            notas: document.getElementById("alqNotas")?.value || "",
        },
        staffAsignado: selectedStaff,
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

    const fields = [
        "date",
        "type",
        "client",
        "cuit",
        "place",
        "horaInicio",
        "horaFin",
        "guests",
        "staffNecesario",
        "total",
        "deposit",
        "status",
        "invoiceNumber",
        "notes",
        "invoiceType",
        "placeUrl",
    ];

    fields.forEach((field) => {
        const el = document.getElementById(field);
        if (el) {
            el.value = evento[field] || (field === "invoiceType" ? "B/C" : "");
        }
    });

    const alq = evento.alquileres || {};

    const alqVajilla = document.getElementById("alqVajilla");
    const alqManteleria = document.getElementById("alqManteleria");
    const alqMobiliario = document.getElementById("alqMobiliario");
    const alqMobiliarioTrabajo = document.getElementById("alqMobiliarioTrabajo");
    const alqNotas = document.getElementById("alqNotas");

    if (alqVajilla) alqVajilla.checked = alq.vajilla || false;
    if (alqManteleria) alqManteleria.checked = alq.manteleria || false;
    if (alqMobiliario) alqMobiliario.checked = alq.mobiliario || false;
    if (alqMobiliarioTrabajo) {
        alqMobiliarioTrabajo.checked = alq.mobiliarioTrabajo || false;
    }
    if (alqNotas) alqNotas.value = alq.notas || "";

    const paidEl = document.getElementById("paid");
    if (paidEl) {
        paidEl.value = evento.paid ? "true" : "false";
    }

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

    const verBtn = document.getElementById("btnVerPresupuesto");
    const eliminarBtn = document.getElementById("btnEliminarPresupuesto");
    const subirBtn = document.getElementById("btnSubirPresupuesto");
    const infoEl = document.getElementById("presupuestoInfo");
    const puedeEditar = puedeEditarPresupuesto();

    if (infoEl) {
        infoEl.textContent = evento.presupuestoNombre
            ? `Archivo: ${evento.presupuestoNombre}`
            : "No hay presupuesto adjunto.";
    }

    if (subirBtn) {
        subirBtn.style.display = puedeEditar ? "inline-block" : "none";
    }

    if (verBtn) {
        verBtn.style.display = evento.presupuestoURL ? "inline-block" : "none";
        verBtn.onclick = () => window.open(evento.presupuestoURL, "_blank");
    }

    if (eliminarBtn) {
        eliminarBtn.style.display =
            puedeEditar && evento.presupuestoURL ? "inline-block" : "none";
    }
    const today = new Date().toISOString().split("T")[0];
    const eventoPasado = evento.date < today;

    const btnStaff = document.getElementById("btnGestionarStaff");
    const btnChecklist = document.getElementById("btnGestionarChecklist");

    if (btnStaff) btnStaff.style.display = "";
    if (btnChecklist) btnChecklist.style.display = "";

    if (eventoPasado) {
        if (subirBtn) subirBtn.style.display = "none";
        if (eliminarBtn) eliminarBtn.style.display = "none";
    }
    // Resetear panel de selección de staff al abrir el formulario
    const panelSeleccion = document.getElementById("contenedorSeleccionStaff");
    if (panelSeleccion) panelSeleccion.style.display = "none";
    const btnAbrirSeleccion = document.getElementById("btnAbrirSeleccion");
    if (btnAbrirSeleccion) {
        btnAbrirSeleccion.innerText = "+ Agregar";
        btnAbrirSeleccion.disabled = false;
        btnAbrirSeleccion.classList.remove("completo");
    }
}
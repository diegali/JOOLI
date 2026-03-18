// js/events/events-budget.js

import {
    doc,
    updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

export function puedeEditarPresupuesto(auth) {
    const email = auth.currentUser?.email;
    return email === "almos2712@hotmail.com" || email === "mariano@a.com";
}

export function actualizarUIBudget(evento, deps) {
    const { auth } = deps;

    const verBtn = document.getElementById("btnVerPresupuesto");
    const eliminarBtn = document.getElementById("btnEliminarPresupuesto");
    const subirBtn = document.getElementById("btnSubirPresupuesto");
    const infoEl = document.getElementById("presupuestoInfo");

    const puedeEditar = puedeEditarPresupuesto(auth);

    if (infoEl) {
        infoEl.textContent = evento?.presupuestoNombre
            ? `Archivo: ${evento.presupuestoNombre}`
            : "No hay presupuesto adjunto.";
    }

    if (subirBtn) {
        subirBtn.style.display = puedeEditar ? "inline-block" : "none";
    }

    if (verBtn) {
        verBtn.style.display = evento?.presupuestoURL ? "inline-block" : "none";
        verBtn.onclick = evento?.presupuestoURL
            ? () => window.open(evento.presupuestoURL, "_blank")
            : null;
    }

    if (eliminarBtn) {
        eliminarBtn.style.display =
            puedeEditar && evento?.presupuestoURL ? "inline-block" : "none";
    }
}

export async function subirPresupuestoEvento(editingId, deps) {
    const { storage, db, auth } = deps;

    if (!editingId) {
        window.mostrarAvisoSimple(
            "Evento sin guardar",
            "Primero guardá el evento antes de subir un presupuesto.",
            "⚠️"
        );
        return null;
    }

    const input = document.getElementById("presupuestoFile");
    const file = input?.files?.[0];

    if (!file) {
        window.mostrarAvisoSimple(
            "Sin archivo",
            "Seleccioná un archivo PDF.",
            "⚠️"
        );
        return null;
    }

    const filePath = `presupuestos/${editingId}/${file.name}`;
    const storageRef = ref(storage, filePath);

    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const eventoRef = doc(db, "events", editingId);
    const presupuestoData = {
        presupuestoURL: url,
        presupuestoNombre: file.name,
        presupuestoPath: filePath,
    };

    await updateDoc(eventoRef, presupuestoData);
    const eventoEnMemoria = (window.allEventsData || []).find(e => e.id === editingId);
    if (eventoEnMemoria) {
        eventoEnMemoria.presupuestoURL = url;
        eventoEnMemoria.presupuestoNombre = file.name;
        eventoEnMemoria.presupuestoPath = filePath;
    }

    actualizarUIBudget(presupuestoData, { auth });

    window.mostrarAvisoSimple(
        "Presupuesto subido",
        "El presupuesto se adjuntó correctamente.",
        "✅"
    );

    return presupuestoData;
}

export async function eliminarPresupuestoEvento(editingId, deps) {
    const { db, storage, auth } = deps;

    if (!editingId) return;

    const evento = (window.allEventsData || []).find((e) => e.id === editingId);
    if (!evento?.presupuestoPath) return;

    try {
        const fileRef = ref(storage, evento.presupuestoPath);
        await deleteObject(fileRef);

        const eventoRef = doc(db, "events", editingId);
        await updateDoc(eventoRef, {
            presupuestoURL: "",
            presupuestoNombre: "",
            presupuestoPath: "",
        });

        actualizarUIBudget(null, { auth });

        window.mostrarAvisoSimple(
            "Presupuesto eliminado",
            "El presupuesto se eliminó correctamente.",
            "✅"
        );
    } catch (error) {
        console.error("Error eliminando presupuesto:", error);
        window.mostrarAvisoSimple(
            "Error",
            "No se pudo eliminar el presupuesto.",
            "❌"
        );
    }
}
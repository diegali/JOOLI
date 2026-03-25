// js/events/events-utils.js

import { auth } from "../auth.js";

export function getCurrentUserName() {
    const email = auth.currentUser?.email;
    return USUARIOS_MAP[email] || email || "Usuario";
}

export function formatDateShort(dateStr) {
    if (!dateStr) return "";

    const d = new Date(dateStr + "T00:00:00");
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const aa = String(d.getFullYear()).slice(-2);

    return `${dd}/${mm}/${aa}`;
}

export function getMonthLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");

    const months = [
        "Enero",
        "Febrero",
        "Marzo",
        "Abril",
        "Mayo",
        "Junio",
        "Julio",
        "Agosto",
        "Septiembre",
        "Octubre",
        "Noviembre",
        "Diciembre",
    ];

    return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDate(dateStr) {
    if (!dateStr) return "";

    const d = new Date(dateStr + "T00:00:00");
    const dia = d.toLocaleDateString("es-AR", { weekday: "long" });
    const fecha = d.toLocaleDateString("es-AR");
    return dia.charAt(0).toUpperCase() + dia.slice(1) + " " + fecha;
}

export const STATUS_COLORS = {
    "Presupuestado": "#f1c40f",
    "Seña pagada": "#e67e22",
    "Confirmado": "#27ae60",
    "Realizado": "#2980b9",
    "Cancelado": "#c0392b",
};

export const USUARIOS_MAP = {
    "almos2712@hotmail.com": "Laura",
    "mariano@a.com": "Mariano",
    "seba@a.com": "Sebastián",
};
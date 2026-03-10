import { db } from "./auth.js";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Función para guardar
export async function guardarMozo() {
  const nombre = document.getElementById("mozoNombre").value;
  const telefono = document.getElementById("mozoTelefono").value;

  if (!nombre || !telefono) return alert("Completa todos los campos");

  try {
    await addDoc(collection(db, "staff"), {
      nombre,
      telefono,
      createdAt: new Date(),
    });
    document.getElementById("mozoNombre").value = "";
    document.getElementById("mozoTelefono").value = "";
  } catch (e) {
    console.error(e);
  }
}

// 2. Función para borrar
window.borrarMozo = async (id) => {
  if (confirm("¿Seguro que querés eliminar a este mozo?")) {
    await deleteDoc(doc(db, "staff", id));
  }
};

// 3. Escuchar cambios en tiempo real y dibujar la lista
export function cargarListaStaff() {
  const q = query(collection(db, "staff"), orderBy("nombre", "asc"));

  onSnapshot(q, (snapshot) => {
    const listaDiv = document.getElementById("listaStaff");
    listaDiv.innerHTML = ""; // Limpiamos antes de recargar

    snapshot.forEach((doc) => {
      const mozo = doc.data();
      listaDiv.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 8px; margin-bottom: 5px; border-radius: 5px; font-size: 0.9em;">
                    <div>
                        <strong>${mozo.nombre}</strong><br>
                        <small style="color: #666;">${mozo.telefono}</small>
                    </div>
                    <button onclick="borrarMozo('${doc.id}')" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 1.2em;">
                        🗑️
                    </button>
                </div>
            `;
    });
  });
}

// Exponer funciones al HTML
window.guardarMozo = guardarMozo;
window.cerrarModal = () =>
  (document.getElementById("staffModal").style.display = "none");
window.abrirModal = () => {
  document.getElementById("staffModal").style.display = "flex";
  cargarListaStaff(); // Cargamos la lista al abrir
};

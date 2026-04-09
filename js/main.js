import "./ui.js";
import { initEvents } from "./events.js";
import { mostrarNombreDia } from "./events/events-form.js";
import { initCalendar } from "./calendar.js";
import { initStaff } from "./staff.js";
import { auth, db } from "./auth.js";
import { initLista } from "./lista.js";
import { initListaCocina } from "./lista-cocina.js";
import { USUARIOS_MAP } from "./events/events-utils.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  onSnapshot,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.mostrarNombreDia = mostrarNombreDia;
// ===============================
// SECCIONES Y UI
// ===============================
window.showSection = function (sectionId) {
  // Si hay un evento en edición, advertir antes de cambiar de sección
  if (window.editingId) {
    const client = document.getElementById("client")?.value;
    if (client) {
      window.mostrarAvisoSimple(
        "¿Salir sin guardar?",
        `Estás editando el evento de <strong>${client}</strong>. Si salís perderás los cambios.<br><br>` +
        `<button onclick="document.getElementById('modalAvisoSimple').style.display='none'; window._pendingSectionChange='${sectionId}'; window.resetFormConfirmado(); window.showSection('${sectionId}')" class="btn-aviso-confirmar">Salir sin guardar</button>
       <button onclick="document.getElementById('modalAvisoSimple').style.display='none'" class="btn-aviso-cancelar">Volver a editar</button>`,
        "⚠️", false
      );
      return;
    }
  }
  const sections = ["calendar", "eventsList", "statsContainer", "staffSection"];
  const searchSection = document.getElementById("searchSection");
  const addEventContainer = document.getElementById("addEventContainer");
  const formContainer = document.getElementById("eventFormContainer");
  const summaryEl = document.getElementById("daySummary");
  const filtrosEventos = document.getElementById("filtrosEventos");

  if (formContainer) formContainer.style.display = "none";
  if (summaryEl) summaryEl.style.display = "none";

  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";

    const btn = document.getElementById(`btn-${id}`);
    if (btn) btn.classList.toggle("active", id === sectionId);
  });

  if (searchSection) {
    searchSection.style.display = sectionId === "eventsList" ? "block" : "none";
  }

  if (filtrosEventos) {
    filtrosEventos.style.display = sectionId === "eventsList" ? "block" : "none";
  }

  if (addEventContainer) {
    addEventContainer.style.display = sectionId === "calendar" ? "block" : "none";
  }

  if (sectionId === "staffSection") {
    if (typeof window.cargarListaStaffSeccion === "function") {
      window.cargarListaStaffSeccion();
    }
  }

  if (sectionId === "calendar") {
    window.dispatchEvent(new Event("resize"));
    if (typeof refreshCalendar === "function") refreshCalendar();
  }
};

function updateUserNameDisplay() {
  const userNameDisplay = document.getElementById("userNameDisplay");
  if (!userNameDisplay) return;

  const email = auth.currentUser?.email;
  userNameDisplay.innerText = USUARIOS_MAP[email] || "Usuario";
}

document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // CERRAR MODALES AL HACER CLICK FUERA
  // ===============================
  window.addEventListener("click", (e) => {
    const modalStaff = document.getElementById("modalGestionStaff");
    const modalEnvio = document.getElementById("modalEnvio");

    if (e.target === modalStaff && window.cerrarModalGestionStaff) {
      window.cerrarModalGestionStaff();
    }

    if (e.target === modalEnvio) {
      modalEnvio.style.display = "none";
    }
  });

  // ===============================
  // NOTIFICACIONES
  // ===============================
  const notifSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"
  );

  let inicializado = false;
  let cantidadAnterior = 0;
  let isProcessing = false;

  const notifWrapper = document.getElementById("notificationWrapper");
  const notifPanel = document.getElementById("notificationPanel");

  if (notifWrapper) {
    notifWrapper.onclick = (e) => {
      if (isProcessing) return;

      isProcessing = true;
      e.stopPropagation();

      const estaAbierto = notifPanel.style.display === "block";
      notifPanel.style.display = estaAbierto ? "none" : "block";

      if (!estaAbierto) {
        marcarNotificacionesComoLeidas();
      }

      setTimeout(() => {
        isProcessing = false;
      }, 300);
    };
  }

  document.onclick = (e) => {
    if (notifPanel && !notifWrapper?.contains(e.target)) {
      notifPanel.style.display = "none";
    }
  };

  function formatarHora(timestamp) {
    if (!timestamp) return "";

    return timestamp
      .toDate()
      .toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  }

  function iniciarEscuchadorNotificaciones() {
    const userEmail = auth.currentUser?.email;
    const countEl = document.getElementById("notifCount");

    const q = query(
      collection(db, "notificaciones"),
      where("leida", "==", false)
    );

    onSnapshot(q, (snapshot) => {
      const filtradas = snapshot.docs.filter(
        (d) => d.data().creadoPorEmail !== userEmail
      );

      const cantidadActual = filtradas.length;

      if (inicializado && cantidadActual > cantidadAnterior) {
        notifSound.play().catch(() => { });
      }

      if (countEl) {
        countEl.innerText = cantidadActual;
        countEl.style.display = cantidadActual > 0 ? "flex" : "none";
      }

      cantidadAnterior = cantidadActual;
      inicializado = true;
    });
  }

  async function marcarNotificacionesComoLeidas() {
    const userEmail = auth.currentUser?.email;

    try {
      const q = query(
        collection(db, "notificaciones"),
        where("leida", "==", false),
        orderBy("fecha", "desc")
      );

      const snapshot = await getDocs(q);

      const paraMostrar = snapshot.docs
        .filter((d) => d.data().creadoPorEmail !== userEmail)
        .sort(
          (a, b) =>
            (b.data().fecha?.seconds || 0) - (a.data().fecha?.seconds || 0)
        );

      const notifList = document.getElementById("notifList");

      if (notifList) {
        notifList.innerHTML =
          paraMostrar.length === 0
            ? "<li class='notif-sin-novedades'>Sin novedades</li>"
            : "";

        paraMostrar.forEach((d) => {
          const data = d.data();
          const li = document.createElement("li");

          li.innerHTML = `
          <div class="notif-item">
            <span>${data.mensaje}</span><br>
            <small class="notif-item__hora">${formatarHora(data.fecha)}</small>
          </div>
          `;

          notifList.appendChild(li);
        });
      }

      if (paraMostrar.length > 0) {
        setTimeout(async () => {
          const updatePromises = paraMostrar.map((d) =>
            updateDoc(doc(db, "notificaciones", d.id), { leida: true })
          );

          await Promise.all(updatePromises);
        }, 3000);
      }
    } catch (e) {
      console.error("Error:", e);
    }
  }

  // ===============================
  // LOGIN / LOGOUT
  // ===============================
  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value;
    const pass = document.getElementById("password")?.value;

    if (!email || !pass) return;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      alert("Error: " + e.message);
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
  });

  // ===============================
  // ESTADO DE LOGIN
  // ===============================
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");

    if (user) {
      if (loginDiv) loginDiv.style.display = "none";
      if (appDiv) appDiv.style.display = "block";
      const header = document.getElementById("mainHeader");
      if (header) header.style.display = "flex";

      updateUserNameDisplay();

      initEvents();
      initCalendar();
      initStaff();
      initLista();
      initListaCocina();

      iniciarEscuchadorNotificaciones();
      window.showSection("calendar");
    } else {
      if (loginDiv) loginDiv.style.display = "block";
      if (appDiv) appDiv.style.display = "none";
    }
  });
});
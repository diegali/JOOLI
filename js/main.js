import { initEvents } from "./events.js";
import { initCalendar } from "./calendar.js";
import { auth, db } from "./auth.js";
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
  onSnapshot, // <-- IMPORTANTE: Agregamos onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- SECCIONES Y UI ---
window.showSection = function (sectionId) {
  const sections = ["calendar", "eventsList", "statsContainer"];
  const searchSection = document.getElementById("searchSection");
  const addEventContainer = document.getElementById("addEventContainer");
  const formContainer = document.getElementById("eventFormContainer"); // El formulario
  const summaryEl = document.getElementById("daySummary"); // El resumen del calendario

  // 1. Ocultar formulario y resumen al cambiar de sección
  if (formContainer) formContainer.style.display = "none";
  if (summaryEl) summaryEl.style.display = "none";

  // 2. Lógica existente de secciones
  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";
    const btn = document.getElementById(`btn-${id}`);
    if (btn) btn.classList.toggle("active", id === sectionId);
  });

  // 3. Ajustes de UI específicos
  if (searchSection) searchSection.style.display = sectionId === "eventsList" ? "block" : "none";
  if (addEventContainer) addEventContainer.style.display = sectionId === "calendar" ? "block" : "none";

  // Si volvemos al calendario, refrescamos el tamaño
  if (sectionId === "calendar") {
    window.dispatchEvent(new Event("resize"));
    if (typeof refreshCalendar === 'function') refreshCalendar();
  }
};

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  // Variable global para el audio de notificación
  const notifSound = new Audio("https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"); // Un sonido de "pop" limpio
  let inicializado = false; // Para que no suene al cargar la página por primera vez
  const notifWrapper = document.getElementById("notificationWrapper");
  const notifPanel = document.getElementById("notificationPanel");
  const notifList = document.getElementById("notifList");
  const countEl = document.getElementById("notifCount");

  // Auxiliar para formatear la hora (ej: 14:30)
  function formatarHora(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate(); // Convierte el Timestamp de Firebase a Date de JS
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  // --- 1. VIGILANTE DE NOTIFICACIONES (TIEMPO REAL) ---
  let cantidadAnterior = 0;

  function iniciarEscuchadorNotificaciones() {
    const userEmail = auth.currentUser?.email;
    const countEl = document.getElementById("notifCount");

    const q = query(collection(db, "notificaciones"), where("leida", "==", false));

    onSnapshot(q, (snapshot) => {
      // Filtramos las que no son mías
      const filtradas = snapshot.docs.filter(doc => doc.data().creadoPorEmail !== userEmail);
      const cantidadActual = filtradas.length;

      // Si la cantidad aumentó y ya pasó la carga inicial, ¡suena!
      if (inicializado && cantidadActual > cantidadAnterior) {
        notifSound.play().catch(e => console.log("El navegador bloqueó el audio hasta que interactúes con la página."));
      }

      // Actualizamos la UI
      if (countEl) {
        if (cantidadActual > 0) {
          countEl.innerText = cantidadActual;
          countEl.style.display = "flex";
        } else {
          countEl.style.display = "none";
        }
      }

      // Guardamos el estado para la próxima comparación
      cantidadAnterior = cantidadActual;
      inicializado = true;
    });
  }

  // --- 2. LÓGICA DE ABRIR PANEL ---
  notifWrapper?.addEventListener("click", () => {
    const isVisible = notifPanel.style.display === "block";
    notifPanel.style.display = isVisible ? "none" : "block";

    if (!isVisible) {
      marcarNotificacionesComoLeidas();
    }
  });

  document.addEventListener("click", (e) => {
    if (notifWrapper && notifPanel && !notifWrapper.contains(e.target) && !notifPanel.contains(e.target)) {
      notifPanel.style.display = "none";
    }
  });

  async function marcarNotificacionesComoLeidas() {
    const userEmail = auth.currentUser?.email;
    const notifList = document.getElementById("notifList");

    try {
      const q = query(collection(db, "notificaciones"), where("leida", "==", false));
      const snapshot = await getDocs(q);

      // Filtrar las que no son mías para mostrar en la lista
      const paraMostrar = snapshot.docs.filter(d => d.data().creadoPorEmail !== userEmail);

      if (notifList) {
        if (paraMostrar.length === 0) {
          notifList.innerHTML = "<li style='color:#888; text-align:center;'>No hay novedades</li>";
        } else {
          notifList.innerHTML = "";
          paraMostrar.forEach(d => {
            const data = d.data();
            const hora = formatarHora(data.fecha);

            const li = document.createElement("li");
            li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
              <span>${data.mensaje}</span>
              <small style="color:#d4af37; margin-left:10px; font-weight:bold;">${hora}</small>
            </div>
          `;
            notifList.appendChild(li);
          });
        }
      }

      // Marcamos como leídas TODAS las que estaban pendientes (incluidas las nuestras 
      // para que no queden "huérfanas" en la DB)
      const updatePromises = snapshot.docs.map(d =>
        updateDoc(doc(db, "notificaciones", d.id), { leida: true })
      );
      await Promise.all(updatePromises);

    } catch (e) {
      console.error("Error al procesar notificaciones:", e);
    }
  }

  // --- LÓGICA DE LOGIN/LOGOUT ---
  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value;
    const pass = document.getElementById("password")?.value;
    if (email && pass) {
      try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert("Error: " + e.message); }
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
  });

  // --- ESTADO USUARIO ---
  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");

    if (user) {
      if (loginDiv) loginDiv.style.display = "none";
      if (appDiv) appDiv.style.display = "block";
      initEvents();
      initCalendar();
      iniciarEscuchadorNotificaciones(); // <-- LLAMAMOS AL ESCUCHADOR AQUÍ
      window.showSection("calendar");
    } else {
      if (loginDiv) loginDiv.style.display = "block";
      if (appDiv) appDiv.style.display = "none";
    }
  });
});
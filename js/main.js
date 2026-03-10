import { initEvents } from "./events.js";
import { initCalendar } from "./calendar.js";
import { guardarMozo } from "./staff.js";
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
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// --- SECCIONES Y UI ---
window.showSection = function (sectionId) {
  const sections = ["calendar", "eventsList", "statsContainer"];
  const searchSection = document.getElementById("searchSection");
  const addEventContainer = document.getElementById("addEventContainer");
  const formContainer = document.getElementById("eventFormContainer");
  const summaryEl = document.getElementById("daySummary");

  // Ocultar elementos al cambiar de sección
  if (formContainer) formContainer.style.display = "none";
  if (summaryEl) summaryEl.style.display = "none";

  sections.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === sectionId ? "block" : "none";
    const btn = document.getElementById(`btn-${id}`);
    if (btn) btn.classList.toggle("active", id === sectionId);
  });

  if (searchSection)
    searchSection.style.display = sectionId === "eventsList" ? "block" : "none";
  if (addEventContainer)
    addEventContainer.style.display =
      sectionId === "calendar" ? "block" : "none";

  if (sectionId === "calendar") {
    window.dispatchEvent(new Event("resize"));
    if (typeof refreshCalendar === "function") refreshCalendar();
  }
};

// --- FUNCIÓN PARA MOSTRAR NOMBRE DE USUARIO ---
function updateUserNameDisplay() {
  const userNameDisplay = document.getElementById("userNameDisplay");
  if (!userNameDisplay) return;

  const email = auth.currentUser?.email;
  const usuariosMap = {
    "almos2712@hotmail.com": "Laura",
    "mariano@a.com": "Mariano",
    "seba@a.com": "Sebastián",
  };

  const nombre = usuariosMap[email] || "Usuario";
  userNameDisplay.innerText = `${nombre}`;
}

// --- INICIALIZACIÓN ---
document.addEventListener("DOMContentLoaded", () => {
  const notifSound = new Audio(
    "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
  );
  let inicializado = false;
  const notifWrapper = document.getElementById("notificationWrapper");
  const notifPanel = document.getElementById("notificationPanel");

  function formatarHora(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  let cantidadAnterior = 0;

  function iniciarEscuchadorNotificaciones() {
    const userEmail = auth.currentUser?.email;
    const countEl = document.getElementById("notifCount");
    const q = query(
      collection(db, "notificaciones"),
      where("leida", "==", false),
    );

    onSnapshot(q, (snapshot) => {
      const filtradas = snapshot.docs.filter(
        (doc) => doc.data().creadoPorEmail !== userEmail,
      );
      const cantidadActual = filtradas.length;

      if (inicializado && cantidadActual > cantidadAnterior) {
        notifSound
          .play()
          .catch((e) => console.log("Audio bloqueado por navegador."));
      }

      if (countEl) {
        countEl.innerText = cantidadActual;
        countEl.style.display = cantidadActual > 0 ? "flex" : "none";
      }

      cantidadAnterior = cantidadActual;
      inicializado = true;
    });
  }

  notifWrapper?.addEventListener("click", () => {
    const isVisible = notifPanel.style.display === "block";
    notifPanel.style.display = isVisible ? "none" : "block";
    if (!isVisible) marcarNotificacionesComoLeidas();
  });

  async function marcarNotificacionesComoLeidas() {
    const userEmail = auth.currentUser?.email;
    try {
      const q = query(
        collection(db, "notificaciones"),
        where("leida", "==", false),
      );
      const snapshot = await getDocs(q);
      const paraMostrar = snapshot.docs.filter(
        (d) => d.data().creadoPorEmail !== userEmail,
      );

      const notifList = document.getElementById("notifList");
      if (notifList) {
        notifList.innerHTML =
          paraMostrar.length === 0
            ? "<li style='color:#888; text-align:center;'>No hay novedades</li>"
            : "";
        paraMostrar.forEach((d) => {
          const data = d.data();
          const li = document.createElement("li");
          li.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;"><span>${data.mensaje}</span><small style="color:#d4af37; margin-left:10px; font-weight:bold;">${formatarHora(data.fecha)}</small></div>`;
          notifList.appendChild(li);
        });
      }

      const updatePromises = snapshot.docs.map((d) =>
        updateDoc(doc(db, "notificaciones", d.id), { leida: true }),
      );
      await Promise.all(updatePromises);
    } catch (e) {
      console.error("Error:", e);
    }
  }

  document.getElementById("loginBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("email")?.value;
    const pass = document.getElementById("password")?.value;
    if (email && pass) {
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (e) {
        alert("Error: " + e.message);
      }
    }
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    location.reload();
  });

  onAuthStateChanged(auth, (user) => {
    const loginDiv = document.getElementById("loginDiv");
    const appDiv = document.getElementById("appDiv");

    if (user) {
      if (loginDiv) loginDiv.style.display = "none";
      if (appDiv) appDiv.style.display = "block";
      updateUserNameDisplay();
      initEvents();
      initCalendar();
      iniciarEscuchadorNotificaciones();
      window.showSection("calendar");
    } else {
      if (loginDiv) loginDiv.style.display = "block";
      if (appDiv) appDiv.style.display = "none";
    }
  });
});

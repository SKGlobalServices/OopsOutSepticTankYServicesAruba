/**
 * 🔒 PROTECCIÓN AVANZADA CONTRA SCREENSHOTS (WEB)
 * NOTA: No existe bloqueo 100% real en navegador,
 * pero esto lo hace MUY difícil y molesto.
 */

import { push, ref, set } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "./security";

let screenshotAttempts = 0;
let isActive = false;

/**
 * 🚀 INICIAR PROTECCIÓN
 */
export const initScreenshotProtection = () => {
  if (isActive) return;
  isActive = true;

  document.addEventListener("keydown", handleKeys, true);
  document.addEventListener("keyup", handleKeys, true);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);

  injectGlobalStyles();

  console.log("🔒 Protección anti-screenshot ACTIVADA");
};

/**
 * ⛔ DETECCIÓN DE TECLAS
 */
const handleKeys = (e) => {
  const blocked =
    e.key === "PrintScreen" ||
    e.keyCode === 44 ||
    e.key === "F12" ||
    e.keyCode === 123 ||
    (e.ctrlKey && e.shiftKey && ["I", "C", "J"].includes(e.key.toUpperCase())) ||
    (e.ctrlKey && e.key.toUpperCase() === "S");

  if (blocked) {
    e.preventDefault();
    e.stopPropagation();

    triggerProtection("Intento de captura por teclado");
    return false;
  }
};

/**
 * 👁️ DETECTAR CAMBIO DE VISIBILIDAD
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    triggerProtection("Pantalla oculta - posible screenshot externo");
  }
};

/**
 * 🧠 DETECTAR PÉRDIDA DE FOCO
 */
const handleWindowBlur = () => {
  triggerProtection("Ventana perdió foco - posible herramienta externa");
};

/**
 * 🚨 ACCIÓN PRINCIPAL
 */
const triggerProtection = (reason) => {
  screenshotAttempts++;

  logScreenshotAttempt(reason);

  showAlert();
  blockScreen();
};

/**
 * ⚠️ ALERTA VISUAL (MULTIPLE)
 */
const showAlert = () => {
  const alert = document.createElement("div");

  alert.className = "screenshot-alert";
  alert.innerText =
    "⚠️ No se permiten capturas de pantalla en esta aplicación";

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 2500);
};

/**
 * 🟥 BLOQUEAR PANTALLA COMPLETA
 */
const blockScreen = () => {
  let overlay = document.getElementById("screenshot-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "screenshot-overlay";

    document.body.appendChild(overlay);
  }

  overlay.style.display = "block";

  setTimeout(() => {
    overlay.style.display = "none";
  }, 2000);
};

/**
 * 🎨 ESTILOS GLOBALES
 */
const injectGlobalStyles = () => {
  if (document.getElementById("screenshot-style")) return;

  const style = document.createElement("style");
  style.id = "screenshot-style";

  style.innerHTML = `
    #screenshot-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: black;
      opacity: 0.95;
      z-index: 999999;
      display: none;
    }

    .screenshot-alert {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff3b3b;
      color: white;
      padding: 25px 40px;
      border-radius: 12px;
      font-size: 18px;
      font-weight: bold;
      z-index: 1000000;
      text-align: center;
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translate(-50%, -60%); }
      to { opacity: 1; transform: translate(-50%, -50%); }
    }
  `;

  document.head.appendChild(style);
};

/**
 * ☁️ LOG EN FIREBASE
 */
const logScreenshotAttempt = async (reason) => {
  let userData = null;

  try {
    const encryptedUser = localStorage.getItem("user");
    if (encryptedUser) userData = decryptData(encryptedUser);
  } catch {}

  try {
    const newRef = push(ref(database, "screenshotAttempts"));

    await set(newRef, {
      attemptNumber: screenshotAttempts,
      reason,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      userId: userData?.id || "anonymous",
    });
  } catch (err) {
    console.error("Error Firebase:", err);
  }
};

/**
 * 📴 DESACTIVAR
 */
export const disableScreenshotProtection = () => {
  isActive = false;

  document.removeEventListener("keydown", handleKeys, true);
  document.removeEventListener("keyup", handleKeys, true);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("blur", handleWindowBlur);

  console.log("❌ Protección desactivada");
};

/**
 * 📊 ESTADO
 */
export const getScreenshotAttempts = () => ({
  total: screenshotAttempts,
});
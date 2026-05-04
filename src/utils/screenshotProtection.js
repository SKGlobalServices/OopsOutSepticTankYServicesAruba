/**
 * 🔒 PROTECCIÓN AVANZADA CONTRA SCREENSHOTS (WEB)
 * Mejorado: Menos falsas alarmas en desktop y móvil
 */

import { push, ref, set } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "./security";

let screenshotAttempts = 0;
let isActive = false;
let lastLockScreen = 0;
let mobilePasteHandler = null;
let mobileVisibilityHandler = null;

// Detectar si es móvil
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

/**
 * 🚀 INICIAR PROTECCIÓN
 */
export const initScreenshotProtection = () => {
  if (isActive) return;
  isActive = true;

  // En desktop: bloquear teclas
  if (!isMobile()) {
    document.addEventListener("keydown", handleDesktopKeys, true);
    handleScreenCaptureAPI();
  } else {
    // En móvil: detectar captura nativa
    handleMobileScreenshot();
  }

  injectGlobalStyles();

  console.log("🔒 Protección anti-screenshot ACTIVADA");
};

// (No clipboard polling on desktop to avoid permission prompts)

/**
 * ⛔ DETECCIÓN DE TECLAS (DESKTOP)
 * Bloquea: PrintScreen, F12, Ctrl+S, Ctrl+Shift+I/C/J, Win+Shift+S, y botones especiales
 */
const handleDesktopKeys = (e) => {
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
    triggerProtection("Intento de captura por teclado (Desktop)");
    return false;
  }
};

/**
 * 📱 DETECCIÓN DE SCREENSHOT EN MÓVIL
 * Detecta acceso a clipboard y transiciones de app
 */
const handleMobileScreenshot = () => {
  // Detectar acceso a clipboard (si intenta pegar captura)
  mobilePasteHandler = (e) => {
    if (e.clipboardData && e.clipboardData.types.some((t) => t.startsWith("image/"))) {
      triggerProtection("Intento de captura por clipboard");
    }
  };
  document.addEventListener("paste", mobilePasteHandler);

  // Detectar transición sospechosa (app en background)
  mobileVisibilityHandler = () => {
    if (document.visibilityState === "hidden") {
      lastLockScreen = Date.now();
    } else if (document.visibilityState === "visible") {
      // Si salió y regresó en menos de 3 segundos, posible captura
      if (Date.now() - lastLockScreen < 3000) {
        triggerProtection("Transición de app sospechosa (posible captura)");
      }
    }
  };
  document.addEventListener("visibilitychange", mobileVisibilityHandler);
};

/**
 * 🎬 BLOQUEAR SCREEN CAPTURE API
 * Impide acceso a getDisplayMedia (captura de pantalla moderna)
 */
const handleScreenCaptureAPI = () => {
  if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
    navigator.mediaDevices.getDisplayMedia = function(...args) {
      triggerProtection("Intento de captura por Screen Capture API");
      return Promise.reject(new Error("Capturas de pantalla deshabilitadas"));
    };
  }
};

/**
 * Comprobar portapapeles por imágenes (útil cuando PrintScreen guarda imagen en clipboard)
 * Se ejecuta al recibir foco y evita lecturas excesivas por rate limit.
 */
// No checkClipboardForImage on desktop to avoid permission prompts

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
 * ⚠️ ALERTA VISUAL
 */
const showAlert = () => {
  const alert = document.createElement("div");
  alert.className = "screenshot-alert";
  alert.innerText = "⚠️ Las capturas de pantalla están deshabilitadas";

  document.body.appendChild(alert);

  setTimeout(() => {
    alert.remove();
  }, 3000);
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
  }, 2500);
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
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
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
      platform: isMobile() ? "mobile" : "desktop",
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

  document.removeEventListener("keydown", handleDesktopKeys, true);
  // Eliminar handlers móviles si fueron registrados
  if (mobilePasteHandler) {
    document.removeEventListener("paste", mobilePasteHandler);
    mobilePasteHandler = null;
  }
  if (mobileVisibilityHandler) {
    document.removeEventListener("visibilitychange", mobileVisibilityHandler);
    mobileVisibilityHandler = null;
  }

  // Eliminar chequeo/polling de portapapeles (no usado en desktop ahora)

  console.log("❌ Protección desactivada");
};

/**
 * 📊 ESTADO
 */
export const getScreenshotAttempts = () => ({
  total: screenshotAttempts,
});
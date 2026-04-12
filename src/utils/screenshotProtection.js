/**
 * Utility para prevenir capturas de pantalla
 * Detecta y bloquea intentos de screenshot a través de:
 * - Intercepar teclas de Print Screen
 * - Detectar cambios de visibilidad de ventana
 * - Registrar intentos en la base de datos
 */

import { push, ref, set } from "firebase/database";
import { database } from "../Database/firebaseConfig";
import { decryptData } from "./security";

let screenshotAttempts = 0;
let isWindowFocused = true;

/**
 * Inicializa la protección contra screenshots
 */
export const initScreenshotProtection = () => {
  // Bloquear teclas de Print Screen
  document.addEventListener("keydown", handlePrintScreenKey);
  
  // Monitorear cambios de visibilidad de ventana
  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  // Monitorear pérdida de foco (intento de screenshot con herramientas externas)
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("focus", handleWindowFocus);
  
  // Prevenir DevTools en navegadores (opcional, más restrictivo)
  disableDevTools();
  
  console.log("✓ Protección contra screenshots activada");
};

/**
 * Maneja intentos de Print Screen
 */
const handlePrintScreenKey = (e) => {
  // Print Screen key code
  if (e.key === "PrintScreen" || e.keyCode === 44) {
    e.preventDefault();
    e.stopPropagation();
    screenshotAttempts++;
    
    logScreenshotAttempt("Print Screen key pressed");
    showScreenshotAlert();
    
    return false;
  }
  
  // Shift + Print Screen (captura solo ventana activa)
  if (e.shiftKey && e.keyCode === 44) {
    e.preventDefault();
    e.stopPropagation();
    screenshotAttempts++;
    
    logScreenshotAttempt("Shift + Print Screen detected");
    showScreenshotAlert();
    
    return false;
  }
};

/**
 * Detecta cuando la ventana es occultada (posible screenshot)
 */
const handleVisibilityChange = () => {
  if (document.visibilityState === "hidden") {
    screenshotAttempts++;
    logScreenshotAttempt("Window visibility hidden - possible screenshot attempt");
    console.warn("⚠️ Intento de captura de pantalla detectado!");
  }
};

/**
 * Detecta cuando la ventana pierde el foco
 */
const handleWindowBlur = () => {
  isWindowFocused = false;
  const timestamp = new Date().toISOString();
  
  // Registrar que el usuario perdió el foco (podría ser screenshot)
  console.warn(`[${timestamp}] Ventana perdió el foco - Posible intento de screenshot`);
};

/**
 * Detecta cuando la ventana recupera el foco
 */
const handleWindowFocus = () => {
  isWindowFocused = true;
  // Limpiar el estado cuando vuelve el foco
};

/**
 * Muestra una alerta visual cuando se detecta un intento de screenshot
 */
const showScreenshotAlert = () => {
  // Mostrar alerta visual temporal
  const alertDiv = document.createElement("div");
  alertDiv.id = "screenshot-alert";
  alertDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: white;
    padding: 30px 50px;
    border-radius: 15px;
    font-size: 18px;
    font-weight: bold;
    z-index: 99999;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    text-align: center;
    max-width: 400px;
    animation: slideIn 0.3s ease-in-out;
  `;
  
  alertDiv.textContent = "⚠️ Las capturas de pantalla están deshabilitadas en este sistema";
  
  // Agregar estilos de animación si no existen
  if (!document.getElementById("screenshot-styles")) {
    const style = document.createElement("style");
    style.id = "screenshot-styles";
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0;
        }
        to {
          transform: translate(-50%, -50%) scale(1);
          opacity: 1;
        }
      }
      
      @keyframes slideOut {
        to {
          transform: translate(-50%, -50%) scale(0.8);
          opacity: 0;
        }
      }
      
      #screenshot-alert {
        animation: slideIn 0.3s ease-in-out, slideOut 0.3s ease-in-out 2.7s forwards;
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(alertDiv);
  
  // Remover alerta después de 3 segundos
  setTimeout(() => {
    if (alertDiv.parentElement) {
      alertDiv.remove();
    }
  }, 3000);
};

/**
 * Registra intentos de screenshot en Firebase
 */
const logScreenshotAttempt = async (reason) => {
  const timestamp = new Date().toISOString();
  const message = `Screenshot attempt detected #${screenshotAttempts}: ${reason}`;
  
  console.error(message, timestamp);
  
  // Obtener datos del usuario si está disponible
  let userData = null;
  try {
    const encryptedUser = localStorage.getItem("user");
    if (encryptedUser) {
      userData = decryptData(encryptedUser);
    }
  } catch (error) {
    console.warn("No se pudo obtener datos del usuario:", error);
  }

  // Registrar en Firebase
  try {
    const screenshotRef = ref(database, "screenshotAttempts");
    const newRef = push(screenshotRef);
    
    await set(newRef, {
      timestamp,
      timestamp_unix: Date.now(),
      attemptNumber: screenshotAttempts,
      reason,
      userAgent: navigator.userAgent,
      userId: userData?.id || "anonymous",
      userName: userData?.name || "unknown",
      userEmail: userData?.email || "unknown",
      userRole: userData?.role || "unknown",
    });
  } catch (error) {
    console.error("Error logging screenshot attempt to Firebase:", error);
  }
  
  // Si hay múltiples intentos, mostrar advertencia más severa
  if (screenshotAttempts >= 3) {
    console.error("⛔ ALERTA CRÍTICA: Múltiples intentos de captura de pantalla detectados");
  }
};

/**
 * Deshabilita herramientas de desarrollo (opcional)
 * Nota: Esto es facilmente eludible, pero añade una capa adicional
 */
const disableDevTools = () => {
  // Bloquear F12
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      return false;
    }
  });
  
  // Bloquear Ctrl+Shift+I (DevTools en Chrome/Edge)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
      e.preventDefault();
      return false;
    }
  });
  
  // Bloquear Ctrl+Shift+C (Inspector)
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
      e.preventDefault();
      return false;
    }
  });
};

/**
 * Desactiva la protección contra screenshots
 */
export const disableScreenshotProtection = () => {
  document.removeEventListener("keydown", handlePrintScreenKey);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("blur", handleWindowBlur);
  window.removeEventListener("focus", handleWindowFocus);
  
  console.log("Protección contra screenshots desactivada");
};

/**
 * Obtiene estadísticas de intentos
 */
export const getScreenshotAttempts = () => {
  return {
    totalAttempts: screenshotAttempts,
    isWindowFocused,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Reinicia el contador de intentos
 */
export const resetScreenshotAttempts = () => {
  screenshotAttempts = 0;
};

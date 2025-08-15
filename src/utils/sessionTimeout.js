// Timeout de sesión por inactividad
let inactivityTimer = null;
let lastActivity = Date.now();

const TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hora

export const resetInactivityTimer = (logoutCallback) => {
  lastActivity = Date.now();
  
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
  }
  
  inactivityTimer = setTimeout(() => {
    logoutCallback();
  }, TIMEOUT_DURATION);
};

export const initInactivityDetection = (logoutCallback) => {
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
  
  const resetTimer = () => resetInactivityTimer(logoutCallback);
  
  events.forEach(event => {
    document.addEventListener(event, resetTimer, true);
  });
  
  // Iniciar timer
  resetInactivityTimer(logoutCallback);
  
  return () => {
    events.forEach(event => {
      document.removeEventListener(event, resetTimer, true);
    });
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }
  };
};

export const clearInactivityTimer = () => {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
};
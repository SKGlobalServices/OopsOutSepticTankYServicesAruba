// Métricas simples para el módulo de informe de efectivo.
// Registra tiempos de carga y cantidad de escrituras por ámbito funcional.

// Un estado por alcance evita mezclar métricas entre admin, usuario o proyecciones internas.
const scopes = new Map();

// Usa performance.now() cuando existe para tener una medición más precisa que Date.now().
const now = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
};

// Crea o recupera el estado de un alcance específico.
// Cada pantalla del informe puede medir su propia carga sin pisar la de otra.
const getScopeState = (scope) => {
  if (!scopes.has(scope)) {
    scopes.set(scope, {
      startedAt: now(),
      loadLogged: false,
      loadDurationMs: 0,
      writeCount: 0,
    });
  }

  return scopes.get(scope);
};

// Marca el inicio de una nueva carga y reinicia la métrica acumulada del alcance.
export const markInformeLoadStart = (scope) => {
  const state = getScopeState(scope);
  state.startedAt = now();
  state.loadLogged = false;
  state.loadDurationMs = 0;
  state.writeCount = 0;
  return state.startedAt;
};

// Registra una sola vez cuánto tardó en cargar el alcance.
// Si ya se había logueado, devuelve la duración calculada previamente.
export const markInformeLoadComplete = (scope, details = {}) => {
  const state = getScopeState(scope);
  if (state.loadLogged) return state.loadDurationMs;

  state.loadLogged = true;
  const elapsedMs = Math.max(0, Math.round(now() - state.startedAt));
  state.loadDurationMs = elapsedMs;
  console.info(`[${scope}] carga completa en ${elapsedMs}ms`, details);
  return elapsedMs;
};

// Acumula la cantidad de escrituras asociadas a un alcance.
// Sirve para tener una señal simple de cuánto movimiento genera cada pantalla.
export const trackInformeWrites = (scope, amount = 1, details = {}) => {
  const state = getScopeState(scope);
  state.writeCount += amount;
  console.info(`[${scope}] escrituras acumuladas: ${state.writeCount}`, details);
  return state.writeCount;
};

// Devuelve una foto rápida del estado de métricas de un alcance para depuración o consola.
export const getInformeMetricsSnapshot = (scope) => {
  const state = getScopeState(scope);
  return {
    startedAt: state.startedAt,
    loadLogged: state.loadLogged,
    loadDurationMs: state.loadDurationMs,
    writeCount: state.writeCount,
  };
};
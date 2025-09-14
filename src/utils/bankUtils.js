/**
 * Utilidades para manejo de bancos en Aruba
 */

// Lista estática legacy (fallback) – se mantiene por retrocompatibilidad
const STATIC_BANKS = [
  { value: "aruba_bank", label: "Aruba Bank N.V." },
  { value: "caribbean_mercantile", label: "Caribbean Mercantile Bank N.V." },
  { value: "rbc_royal", label: "RBC Royal Bank N.V." },
];

// Caché en memoria para evitar recalcular en cada render
let banksCache = null;
let banksCacheHash = null;

/**
 * Normaliza un código/nombre de banco recibido desde Firebase.
 * - Pasa a minúsculas
 * - Reemplaza espacios y caracteres especiales por guiones bajos
 * - Elimina dobles guiones
 * @param {string} raw
 * @returns {string}
 */
const normalizeBankCode = (raw) => {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
};

/**
 * Genera label legible a partir de un código normalizado.
 * @param {string} code
 * @returns {string}
 */
const buildLabelFromCode = (code) => {
  if (!code) return "Banco Desconocido";
  return code
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

/**
 * Genera un hash sencillo del array de bancos provenientes de datos para invalidar caché.
 * @param {string[]} items
 * @returns {string}
 */
const simpleHash = (items) => items.sort().join("|");

/**
 * Obtiene bancos dinámicamente desde la estructura de datos si se provee.
 * Estructuras soportadas:
 * - data.registroFechas[...].banco
 * - data.data[...].banco
 * - arrays de objetos con campo banco
 * Si no se proveen datos, retorna la lista estática.
 * @param {object} [rootData] - Objeto de datos completo (ej: el que retorna useChartData)
 * @returns {Array<{value:string,label:string}>}
 */
export const getArubanBanks = (rootData) => {
  // Si no hay datos -> fallback estático con "todos" al inicio
  if (!rootData) {
    return [{ value: "todos", label: "Todos los Bancos" }, ...STATIC_BANKS];
  }

  // Recolectar valores crudos
  const collected = new Set();

  const pushIf = (val) => {
    if (val && typeof val === "string") collected.add(val.trim());
  };

  try {
    // Posibles ramas de datos
    const { registroFechas, data } = rootData;

    if (registroFechas && typeof registroFechas === "object") {
      Object.values(registroFechas).forEach((entry) => {
        if (entry && typeof entry === "object") {
          pushIf(entry.banco);
        }
      });
    }

    if (data && typeof data === "object") {
      Object.values(data).forEach((entry) => {
        if (entry && typeof entry === "object") {
          pushIf(entry.banco);
        }
      });
    }
  } catch (e) {
    console.warn("[bankUtils] Error recolectando bancos dinámicos:", e);
  }

  // Si no se encontró nada -> fallback
  if (collected.size === 0) {
    return [{ value: "todos", label: "Todos los Bancos" }, ...STATIC_BANKS];
  }

  const rawBanks = Array.from(collected);
  const hash = simpleHash(rawBanks);

  // Usar caché si no cambió
  if (banksCache && banksCacheHash === hash) {
    return banksCache;
  }

  // Normalizar y construir objetos
  const dynamicBanks = rawBanks
    .map((original) => {
      const normalized = normalizeBankCode(original);
      return {
        value: normalized,
        label: buildLabelFromCode(normalized),
      };
    })
    // filtrar vacíos o duplicados tras normalizar
    .filter((b) => b.value);

  // Mezclar con estáticos para nombres conocidos (preferir label estático si coincide value)
  const staticMap = new Map(STATIC_BANKS.map((b) => [b.value, b.label]));
  const merged = dynamicBanks.map((b) => ({
    value: b.value,
    label: staticMap.get(b.value) || b.label,
  }));

  // Orden alfabético por label
  merged.sort((a, b) => a.label.localeCompare(b.label));

  // Insertar opción "todos" al inicio
  const finalList = [{ value: "todos", label: "Todos los Bancos" }, ...merged];

  banksCache = finalList;
  banksCacheHash = hash;
  return finalList;
};

/**
 * Obtiene el nombre completo del banco dado su código
 * @param {string} bankCode - Código del banco
 * @returns {string} Nombre completo del banco
 */
export const getBankName = (bankCode, rootData) => {
  const banks = getArubanBanks(rootData);
  const bank = banks.find((b) => b.value === bankCode);
  return bank ? bank.label : "Banco desconocido";
};

/**
 * Obtiene el nombre corto del banco para mostrar en indicadores
 * @param {string} bankCode - Código del banco
 * @returns {string} Nombre corto del banco
 */
export const getBankShortName = (bankCode) => {
  const bankNames = {
    todos: "Todos",
    aruba_bank: "Aruba Bank",
    caribbean_mercantile: "Caribbean Mercantile",
    rbc_royal: "RBC Royal Bank",
  };
  return bankNames[bankCode] || bankCode;
};

/**
 * Valida si un código de banco es válido
 * @param {string} bankCode - Código del banco a validar
 * @returns {boolean} True si el banco es válido
 */
export const isValidBankCode = (bankCode, rootData) => {
  const banks = getArubanBanks(rootData);
  return banks.some((bank) => bank.value === bankCode);
};

/**
 * Limpia manualmente el caché (por ejemplo tras un hard refresh de datos)
 */
export const resetBanksCache = () => {
  banksCache = null;
  banksCacheHash = null;
};

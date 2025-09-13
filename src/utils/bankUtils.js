/**
 * Utilidades para manejo de bancos en Aruba
 */

/**
 * Lista de bancos disponibles en Aruba
 * @returns {Array<{value: string, label: string}>} Array de objetos con valor y etiqueta de cada banco
 */
export const getArubanBanks = () => [
  { value: "todos", label: "Todos los Bancos" },
  { value: "aruba_bank", label: "Aruba Bank N.V." },
  { value: "caribbean_mercantile", label: "Caribbean Mercantile Bank N.V." },
  { value: "rbc_royal", label: "RBC Royal Bank N.V." }
];

/**
 * Obtiene el nombre completo del banco dado su código
 * @param {string} bankCode - Código del banco
 * @returns {string} Nombre completo del banco
 */
export const getBankName = (bankCode) => {
  const banks = getArubanBanks();
  const bank = banks.find(b => b.value === bankCode);
  return bank ? bank.label : 'Banco desconocido';
};

/**
 * Obtiene el nombre corto del banco para mostrar en indicadores
 * @param {string} bankCode - Código del banco
 * @returns {string} Nombre corto del banco
 */
export const getBankShortName = (bankCode) => {
  const bankNames = {
    "todos": "Todos",
    "aruba_bank": "Aruba Bank",
    "caribbean_mercantile": "Caribbean Mercantile",
    "rbc_royal": "RBC Royal Bank"
  };
  return bankNames[bankCode] || bankCode;
};

/**
 * Valida si un código de banco es válido
 * @param {string} bankCode - Código del banco a validar
 * @returns {boolean} True si el banco es válido
 */
export const isValidBankCode = (bankCode) => {
  const banks = getArubanBanks();
  return banks.some(bank => bank.value === bankCode);
};

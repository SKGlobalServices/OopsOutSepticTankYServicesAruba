/**
 * Utilidades para manejo de fechas en el dashboard
 */

/**
 * Genera un array de años desde 2000 hasta el año actual
 * @returns {number[]} Array de años ordenados del más reciente al más antiguo
 */
export const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  
  for (let year = 2000; year <= currentYear; year++) {
    years.push(year);
  }
  
  return years.reverse(); // Años más recientes primero
};

/**
 * Array de meses en español con sus valores numéricos
 * @returns {Array<{value: number, label: string}>} Array de objetos con valor y etiqueta de cada mes
 */
export const getMonths = () => [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" }
];

/**
 * Obtiene el mes actual (1-12)
 * @returns {number} Número del mes actual
 */
export const getCurrentMonth = () => {
  return new Date().getMonth() + 1;
};

/**
 * Obtiene el año actual
 * @returns {number} Año actual
 */
export const getCurrentYear = () => {
  return new Date().getFullYear();
};

/**
 * Obtiene el nombre del mes en español dado su número
 * @param {number} monthNumber - Número del mes (1-12)
 * @returns {string} Nombre del mes en español
 */
export const getMonthName = (monthNumber) => {
  const months = getMonths();
  const month = months.find(m => m.value === monthNumber);
  return month ? month.label : 'Mes inválido';
};

/**
 * Valida si un año está en el rango válido (2000 - año actual)
 * @param {number} year - Año a validar
 * @returns {boolean} True si el año es válido
 */
export const isValidYear = (year) => {
  const currentYear = getCurrentYear();
  return year >= 2000 && year <= currentYear;
};

/**
 * Valida si un mes está en el rango válido (1-12)
 * @param {number} month - Mes a validar
 * @returns {boolean} True si el mes es válido
 */
export const isValidMonth = (month) => {
  return month >= 1 && month <= 12;
};

/**
 * Formatea una fecha para mostrar en los filtros
 * @param {string} type - Tipo de filtro ("mes" o "año")
 * @param {number} month - Número del mes
 * @param {number} year - Año
 * @returns {string} Fecha formateada
 */
export const formatFilterDate = (type, month, year) => {
  if (type === "mes") {
    return `${month}/${year}`;
  }
  return year.toString();
};

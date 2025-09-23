/**
 * Utilidades para manejo de fechas en el dashboard
 */

/**
 * Extrae todos los años únicos de los datos de Firebase
 * @param {Object} registroFechas - Datos de registrofechas
 * @param {Object} dataTable - Datos de data
 * @returns {number[]} Array de años únicos ordenados
 */
export const extractYearsFromData = (registroFechas = {}, dataTable = {}) => {
  const years = new Set();

  // Extraer años de registroFechas (estructura anidada por fecha)
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    // Parsear fecha en formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, , year] = fecha.split("-");
      const yearNum = parseInt(year);
      if (yearNum && yearNum > 1900) {
        years.add(yearNum);
      }
    }

    // También revisar fechas en los registros individuales
    Object.values(registros).forEach((record) => {
      const recordFecha = record.fecha || record.fechaEjecucion;
      if (recordFecha) {
        const yearFromRecord = extractYearFromDate(recordFecha);
        if (yearFromRecord) years.add(yearFromRecord);
      }
    });
  });

  // Extraer años de data (estructura plana)
  Object.values(dataTable).forEach((record) => {
    const recordFecha = record.fecha || record.fechaEjecucion;
    if (recordFecha) {
      const yearFromRecord = extractYearFromDate(recordFecha);
      if (yearFromRecord) years.add(yearFromRecord);
    }
  });

  // Convertir Set a Array y ordenar
  return Array.from(years).sort((a, b) => a - b);
};

/**
 * Extrae el año de una fecha en diferentes formatos
 * @param {string} fecha - Fecha en formato DD-MM-YYYY o estándar
 * @returns {number|null} Año extraído o null si no es válido
 */
const extractYearFromDate = (fecha) => {
  if (!fecha) return null;

  // Formato DD-MM-YYYY
  if (fecha.includes("-") && fecha.split("-").length === 3) {
    const [, , year] = fecha.split("-");
    const yearNum = parseInt(year);
    return yearNum && yearNum > 1900 ? yearNum : null;
  }

  // Formato de fecha estándar
  try {
    const date = new Date(fecha);
    const year = date.getFullYear();
    return year && year > 1900 ? year : null;
  } catch {
    return null;
  }
};

/**
 * Genera un array de años basado en los datos disponibles
 * @param {Object} registroFechas - Datos de registrofechas (opcional)
 * @param {Object} dataTable - Datos de data (opcional)
 * @returns {number[]} Array de años ordenados del más reciente al más antiguo
 */
export const generateYears = (registroFechas = {}, dataTable = {}) => {
  // Si no hay datos, usar rango por defecto
  if (
    Object.keys(registroFechas).length === 0 &&
    Object.keys(dataTable).length === 0
  ) {
    const currentYear = new Date().getFullYear();
    const years = [];

    for (let year = 2020; year <= currentYear; year++) {
      years.push(year);
    }

    return years.reverse();
  }

  // Extraer años de los datos
  const dataYears = extractYearsFromData(registroFechas, dataTable);

  if (dataYears.length === 0) {
    // Si no se encontraron años válidos, usar rango por defecto
    const currentYear = new Date().getFullYear();
    const years = [];

    for (let year = 2020; year <= currentYear; year++) {
      years.push(year);
    }

    return years.reverse();
  }

  // Usar el año mínimo encontrado hasta el año actual
  const minYear = Math.min(...dataYears);
  const currentYear = new Date().getFullYear();
  const years = [];

  for (let year = minYear; year <= currentYear; year++) {
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
  { value: 12, label: "Diciembre" },
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
  const month = months.find((m) => m.value === monthNumber);
  return month ? month.label : "Mes inválido";
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
 * @param {string} type - Tipo de filtro ("semanas", "meses" o "años")
 * @param {number} month - Número del mes (para filtros de semanas)
 * @param {number} year - Año (para filtros de semanas y meses)
 * @returns {string} Fecha formateada
 */
export const formatFilterDate = (type, month, year) => {
  if (type === "semanas") {
    return `${getMonthName(month)} ${year}`;
  } else if (type === "meses") {
    return `Año ${year}`;
  } else if (type === "años") {
    return "Comparación anual";
  }
  return year.toString();
};

/**
 * Genera un array de días para un mes y año específicos
 * @param {number} month - Número del mes (1-12)
 * @param {number} year - Año
 * @returns {Array<{value: number, label: string}>} Array de objetos con valor y etiqueta de cada día
 */
export const getDaysInMonth = (month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      value: day,
      label: `Día ${day}`
    });
  }
  
  return days;
};

/**
 * Obtiene el día actual
 * @returns {number} Día actual del mes
 */
export const getCurrentDay = () => {
  return new Date().getDate();
};

/**
 * Valida si un día está en el rango válido para un mes específico
 * @param {number} day - Día a validar
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año
 * @returns {boolean} True si el día es válido para el mes/año
 */
export const isValidDay = (day, month, year) => {
  if (!isValidMonth(month) || !isValidYear(year)) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
};

/**
 * Obtiene las opciones de filtro según el tipo seleccionado
 * @param {string} filterType - Tipo de filtro ("días", "semanas", "meses", "años")
 * @returns {Object} Configuración de filtros disponibles
 */
export const getFilterOptions = (filterType) => {
  switch (filterType) {
    case "días":
      return {
        needsMonth: true,
        needsYear: true,
        needsDay: false,
        description: "Mostrar todos los días del mes seleccionado",
      };
    case "semanas":
      return {
        needsMonth: true,
        needsYear: true,
        needsDay: false,
        description: "Comparar semanas dentro del mes seleccionado",
      };
    case "meses":
      return {
        needsMonth: false,
        needsYear: true,
        needsDay: false,
        description: "Comparar meses dentro del año seleccionado",
      };
    case "años":
      return {
        needsMonth: false,
        needsYear: false,
        needsDay: false,
        description: "Comparar diferentes años",
      };
    default:
      return {
        needsMonth: false,
        needsYear: true,
        needsDay: false,
        description: "Filtro por defecto",
      };
  }
};

/**
 * Devuelve los rangos de semanas para un mes/año dados
 * @param {number} month - Mes 1-12
 * @param {number} year - Año
 * @returns {Array<{label:string, range:string}>}
 */
export const getWeekRangesForMonth = (month, year) => {
  if (!month || !year) return [];
  const daysInMonth = new Date(year, month, 0).getDate();
  return [
    { label: "Semana 1", range: `1-${Math.min(7, daysInMonth)}` },
    { label: "Semana 2", range: `8-${Math.min(14, daysInMonth)}` },
    { label: "Semana 3", range: `15-${Math.min(21, daysInMonth)}` },
    { label: "Semana 4", range: `22-${daysInMonth}` },
  ];
};
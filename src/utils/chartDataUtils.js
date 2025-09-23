/**
 * Utilidades para procesar datos de Firebase para las gráficas del dashboard
 */
import { getMonthName } from "./dateUtils";

/**
 * Normaliza la forma de pago de un registro
 * @param {Object} record - Registro de la base de datos
 * @returns {string} Forma de pago normalizada en minúsculas
 */
const normalizeFormaPago = (record) => {
  return (record.formadepago || record.metododepago || "").toLowerCase().trim();
};

/**
 * Extrae el día de una fecha en diferentes formatos
 * @param {string} fecha - Fecha en formato DD-MM-YYYY o estándar
 * @returns {number} Día extraído
 */
const getDayFromDate = (fecha) => {
  if (!fecha) return 0;

  // Formato DD-MM-YYYY
  if (fecha.includes("-") && fecha.split("-").length === 3) {
    const [day] = fecha.split("-");
    return parseInt(day);
  }

  // Formato de fecha estándar
  try {
    const date = new Date(fecha);
    return date.getDate();
  } catch {
    return 0;
  }
};

/**
 * Extrae el día de una fecha de factura (formato YYYY-MM-DD)
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {number} Día extraído
 */
const getDayFromFacturaDate = (fecha) => {
  if (!fecha) return 0;

  // Formato YYYY-MM-DD
  if (fecha.includes("-") && fecha.split("-").length === 3) {
    const [, , day] = fecha.split("-");
    return parseInt(day);
  }

  // Formato de fecha estándar como fallback
  try {
    const date = new Date(fecha);
    return date.getDate();
  } catch {
    return 0;
  }
};

/**
 * Crea una fecha local sin problemas de zona horaria
 * @param {number} year - Año
 * @param {number} month - Mes (1-12)
 * @param {number} day - Día
 * @returns {Date} Fecha local
 */
const createLocalDate = (year, month, day) => {
  return new Date(year, month - 1, day);
};

/**
 * Extrae el día de una fecha evitando problemas de zona horaria
 * @param {string} fecha - Fecha en formato DD-MM-YYYY o estándar
 * @returns {number} Día extraído
 */
const getDayFromDateSafe = (fecha) => {
  if (!fecha) return 0;

  // Formato DD-MM-YYYY
  if (fecha.includes("-") && fecha.split("-").length === 3) {
    const [day, month, year] = fecha.split("-");
    return parseInt(day);
  }

  // Formato de fecha estándar - crear fecha local
  try {
    const date = new Date(fecha);
    // Usar métodos locales para evitar problemas de zona horaria
    return date.getDate();
  } catch {
    return 0;
  }
};

/**
 * Determina el último día que se debe mostrar para un mes/año
 * - Si es el mes y año actuales: hasta el día de hoy
 * - Si es otro mes/año: todos los días del mes
 */
const getMaxDayToShow = (month, year) => {
  const today = new Date();
  const isCurrentMonth = (today.getMonth() + 1) === month && today.getFullYear() === year;
  const daysInMonth = new Date(year, month, 0).getDate();
  return isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth;
};

/**
 * Devuelve el rango de días (ej. "1-7") para una semana del mes
 * @param {"Semana 1"|"Semana 2"|"Semana 3"|"Semana 4"} weekKey
 * @param {number} month - 1-12
 * @param {number} year
 */
const getWeekRangeText = (weekKey, month, year) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  let start = 1;
  let end = 7;
  if (weekKey === "Semana 1") {
    start = 1;
    end = Math.min(7, daysInMonth);
  } else if (weekKey === "Semana 2") {
    start = 8;
    end = Math.min(14, daysInMonth);
  } else if (weekKey === "Semana 3") {
    start = 15;
    end = Math.min(21, daysInMonth);
  } else {
    start = 22;
    end = daysInMonth;
  }
  return `${start}-${end}`;
};

/**
 * Procesa datos de registrofechas y data para obtener transferencias
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (banco, type, month, year)
 * @returns {Array} Array de datos procesados para line chart
 */
export const processTransferenciasData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: "registrofechas",
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: "data",
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar por transferencias
  const transferencias = allRecords.filter((record) => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === "transferencia";
  });

  // Filtrar por banco si no es "todos"
  let filteredTransferencias = transferencias;
  if (filters.banco && filters.banco !== "todos") {
    filteredTransferencias = transferencias.filter((record) => {
      const banco = record.banco || "";
      return banco.toLowerCase().includes(getBankFilterValue(filters.banco));
    });
  }

  // Filtrar por fecha
  filteredTransferencias = filterByDateRange(filteredTransferencias, filters);

  // Procesar datos según el tipo de filtro (días, semanas, meses o años)
  if (filters.type === "días") {
    return processDataByDays(
      filteredTransferencias,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    return processDataByWeeks(
      filteredTransferencias,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    return processDataByMonths(filteredTransferencias, filters.year);
  } else if (filters.type === "años") {
    return processDataByYears(filteredTransferencias);
  } else {
    // Fallback para compatibilidad
    return processDataByMonths(filteredTransferencias, filters.year);
  }
};

/**
 * Procesa datos para obtener efectivo (horizontal bar chart)
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para horizontal bar chart
 */
export const processEfectivoData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: "registrofechas",
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: "data",
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar por efectivo
  const efectivo = allRecords.filter((record) => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === "efectivo";
  });

  // Filtrar por fecha
  const filteredEfectivo = filterByDateRange(efectivo, filters);

  // Procesar datos según el tipo de filtro
  let result;
  if (filters.type === "días") {
    result = processDataByDays(filteredEfectivo, filters.month, filters.year);
  } else if (filters.type === "semanas") {
    result = processDataByWeeks(filteredEfectivo, filters.month, filters.year);
  } else if (filters.type === "meses") {
    result = processDataByMonths(filteredEfectivo, filters.year);
  } else if (filters.type === "años") {
    result = processDataByYears(filteredEfectivo);
  } else {
    // Fallback para compatibilidad
    result = processDataByMonths(filteredEfectivo, filters.year);
  }

  return result;
};

/**
 * Procesa datos para obtener intercambios (simple bar chart)
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para simple bar chart
 */
export const processIntercambiosData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: "registrofechas",
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: "data",
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar por intercambio
  const intercambios = allRecords.filter((record) => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === "intercambio";
  });

  // Filtrar por fecha
  const filteredIntercambios = filterByDateRange(intercambios, filters);

  // Procesar datos según el tipo de filtro
  if (filters.type === "días") {
    return processDataByDays(
      filteredIntercambios,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    return processDataByWeeks(
      filteredIntercambios,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    return processDataByMonths(filteredIntercambios, filters.year);
  } else if (filters.type === "años") {
    return processDataByYears(filteredIntercambios);
  } else {
    // Fallback para compatibilidad
    return processDataByMonths(filteredIntercambios, filters.year);
  }
};

/**
 * Filtra registros por rango de fechas
 * @param {Array} records - Array de registros
 * @param {Object} filters - Filtros con type, month, year
 * @returns {Array} Registros filtrados
 */
const filterByDateRange = (records, filters) => {
  return records.filter((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return false;

    let recordYear, recordMonth;

    // Manejar formato DD-MM-YYYY (usado en registrofechas)
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, month, year] = fecha.split("-");
      recordYear = parseInt(year);
      recordMonth = parseInt(month);
    } else {
      // Manejar formato de fecha estándar (usado en data)
      const recordDate = new Date(fecha);
      recordYear = recordDate.getFullYear();
      recordMonth = recordDate.getMonth() + 1;
    }

    // Para filtro de años, no filtrar por año específico
    if (filters.type === "años") {
      return true; // Incluir todos los años
    }

    // Filtrar por año para filtros de días, semanas y meses
    if (filters.year && recordYear !== filters.year) {
      return false;
    }

    // Si es filtro por días, incluir todos los días del mes seleccionado
    if (filters.type === "días" && filters.month) {
      return recordMonth === filters.month;
    }

    // Si es filtro por semanas, también filtrar por mes
    if (filters.type === "semanas" && filters.month) {
      return recordMonth === filters.month;
    }

    return true;
  });
};

/**
 * Procesa datos agrupándolos por días del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por días
 */
const processDataByDays = (records, month, year) => {
  const days = {};

  // Inicializar días en 0 hasta hoy (si es mes actual) o hasta fin de mes
  const maxDay = getMaxDayToShow(month, year);
  for (let i = 1; i <= maxDay; i++) {
    days[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    const day = getDayFromDateSafe(fecha);
    if (day === 0) return; // Fecha inválida

    // Sumar valor si existe, o contar si no hay valor
    const valor = parseFloat(record.valor);
    days[day] += isNaN(valor) ? 1 : valor;
  });

  return Object.entries(days)
    .map(([day, value]) => ({
      name: `Día ${day}`,
      valor: value,
      cantidad: records.filter((r) => {
        const fecha = r.fecha || r.fechaEjecucion;
        if (!fecha) return false;

        const recordDay = getDayFromDateSafe(fecha);
        return recordDay === parseInt(day);
      }).length,
    }));
};

/**
 * Procesa datos agrupándolos por semanas del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por semanas
 */
const processDataByWeeks = (records, month, year) => {
  const weeks = {
    "Semana 1": 0,
    "Semana 2": 0,
    "Semana 3": 0,
    "Semana 4": 0,
  };

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let day;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [dayStr] = fecha.split("-");
      day = parseInt(dayStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      day = recordDate.getDate();
    }

    const valor = parseFloat(record.valor) || 0;

    // Determinar la semana basada en el día del mes
    let week;
    if (day <= 7) week = "Semana 1";
    else if (day <= 14) week = "Semana 2";
    else if (day <= 21) week = "Semana 3";
    else week = "Semana 4";

    weeks[week] += valor;
  });

  return Object.entries(weeks).map(([week, value]) => ({
    name: `${week}|${getWeekRangeText(week, month, year)}`,
    valor: value,
    cantidad: records.filter((r) => {
      const fecha = r.fecha || r.fechaEjecucion;
      if (!fecha) return false;

      let day;
      if (fecha.includes("-") && fecha.split("-").length === 3) {
        const [dayStr] = fecha.split("-");
        day = parseInt(dayStr);
      } else {
        const recordDate = new Date(fecha);
        day = recordDate.getDate();
      }

      return (
        (week === "Semana 1" && day <= 7) ||
        (week === "Semana 2" && day > 7 && day <= 14) ||
        (week === "Semana 3" && day > 14 && day <= 21) ||
        (week === "Semana 4" && day > 21)
      );
    }).length,
  }));
};

/**
 * Procesa datos agrupándolos por meses del año
 * @param {Array} records - Registros filtrados
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por meses
 */
const processDataByMonths = (records, year) => {
  const months = {};

  // Inicializar todos los meses en 0
  for (let i = 1; i <= 12; i++) {
    months[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let month;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, monthStr] = fecha.split("-");
      month = parseInt(monthStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      month = recordDate.getMonth() + 1;
    }

    const valor = parseFloat(record.valor) || 0;
    months[month] += valor;
  });

  return Object.entries(months)
    .filter(([month, value]) => value > 0) // Solo mostrar meses con datos
    .map(([month, value]) => ({
      name: getMonthName(parseInt(month)),
      valor: value,
      cantidad: records.filter((r) => {
        const fecha = r.fecha || r.fechaEjecucion;
        if (!fecha) return false;

        let recordMonth;
        if (fecha.includes("-") && fecha.split("-").length === 3) {
          const [, monthStr] = fecha.split("-");
          recordMonth = parseInt(monthStr);
        } else {
          const recordDate = new Date(fecha);
          recordMonth = recordDate.getMonth() + 1;
        }

        return recordMonth === parseInt(month);
      }).length,
    }));
};

/**
 * Procesa datos agrupándolos por años
 * @param {Array} records - Registros filtrados
 * @returns {Array} Datos agrupados por años
 */
const processDataByYears = (records) => {
  const years = {};

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let year;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, , yearStr] = fecha.split("-");
      year = parseInt(yearStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      year = recordDate.getFullYear();
    }

    const valor = parseFloat(record.valor) || 0;

    if (!years[year]) {
      years[year] = 0;
    }
    years[year] += valor;
  });

  return Object.entries(years)
    .filter(([year, value]) => value > 0) // Solo mostrar años con datos
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)) // Ordenar por año
    .map(([year, value]) => ({
      name: year,
      valor: value,
      cantidad: records.filter((r) => {
        const fecha = r.fecha || r.fechaEjecucion;
        if (!fecha) return false;

        let recordYear;
        if (fecha.includes("-") && fecha.split("-").length === 3) {
          const [, , yearStr] = fecha.split("-");
          recordYear = parseInt(yearStr);
        } else {
          const recordDate = new Date(fecha);
          recordYear = recordDate.getFullYear();
        }

        return recordYear === parseInt(year);
      }).length,
    }));
};

/**
 * Procesa datos para obtener conteo de servicios
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de servicios
 */
export const processServiciosData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: "registrofechas",
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: "data",
  }));

  // Combinar todos los registros (todos son servicios - NO filtrar por forma de pago)
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar SOLO por fecha (no por forma de pago, todos son servicios)
  const filteredServicios = filterByDateRange(allRecords, filters);

  // Procesar datos según el tipo de filtro
  let result;
  if (filters.type === "días") {
    result = processServiciosByDays(
      filteredServicios,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    result = processServiciosByWeeks(
      filteredServicios,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    result = processServiciosByMonths(filteredServicios, filters.year);
  } else if (filters.type === "años") {
    result = processServiciosByYears(filteredServicios);
  } else {
    // Fallback para filtros antiguos
    result = processServiciosByMonths(filteredServicios, filters.year);
  }
  return result;
};

/**
 * Procesa servicios agrupándolos por días del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por días
 */
const processServiciosByDays = (records, month, year) => {
  const days = {};

  // Inicializar días en 0 hasta hoy (si es mes actual) o hasta fin de mes
  const maxDay = getMaxDayToShow(month, year);
  for (let i = 1; i <= maxDay; i++) {
    days[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    const day = getDayFromDateSafe(fecha);
    if (day === 0) return; // Fecha inválida

    days[day] += 1; // Contar servicios
  });

  return Object.entries(days)
    .map(([day, count]) => ({
      name: `Día ${day}`,
      servicios: count,
      cantidad: count,
    }));
};

/**
 * Procesa servicios agrupándolos por semanas del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por semanas
 */
const processServiciosByWeeks = (records, month, year) => {
  const weeks = {
    "Semana 1": 0,
    "Semana 2": 0,
    "Semana 3": 0,
    "Semana 4": 0,
  };

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let day;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [dayStr] = fecha.split("-");
      day = parseInt(dayStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      day = recordDate.getDate();
    }

    // Determinar la semana basada en el día del mes
    let week;
    if (day <= 7) week = "Semana 1";
    else if (day <= 14) week = "Semana 2";
    else if (day <= 21) week = "Semana 3";
    else week = "Semana 4";

    weeks[week] += 1; // Contar servicios, no sumar valores
  });

  return Object.entries(weeks).map(([week, count]) => ({
    name: `${week}|${getWeekRangeText(week, month, year)}`,
    servicios: count,
    cantidad: count,
  }));
};

/**
 * Procesa servicios agrupándolos por meses del año
 * @param {Array} records - Registros filtrados
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por meses
 */
const processServiciosByMonths = (records, year) => {
  const months = {};

  // Inicializar todos los meses en 0
  for (let i = 1; i <= 12; i++) {
    months[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let month;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, monthStr] = fecha.split("-");
      month = parseInt(monthStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      month = recordDate.getMonth() + 1;
    }

    months[month] += 1; // Contar servicios
  });

  return Object.entries(months)
    .filter(([month, count]) => count > 0) // Solo mostrar meses con datos
    .map(([month, count]) => ({
      name: getMonthName(parseInt(month)),
      servicios: count,
      cantidad: count,
    }));
};

/**
 * Procesa servicios agrupándolos por años
 * @param {Array} records - Registros filtrados
 * @returns {Array} Datos agrupados por años
 */
const processServiciosByYears = (records) => {
  const years = {};

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let year;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, , yearStr] = fecha.split("-");
      year = parseInt(yearStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      year = recordDate.getFullYear();
    }

    if (!years[year]) {
      years[year] = 0;
    }
    years[year] += 1; // Contar servicios
  });

  return Object.entries(years)
    .filter(([year, count]) => count > 0) // Solo mostrar años con datos
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)) // Ordenar por año
    .map(([year, count]) => ({
      name: year,
      servicios: count,
      cantidad: count,
    }));
};

/**
 * Procesa datos para obtener conteo de garantías
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de garantías
 */
export const processGarantiasData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: "registrofechas",
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: "data",
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar por garantías usando normalizeFormaPago
  const garantias = allRecords.filter((record) => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === "garantia" || formaPago === "garantía";
  });

  // Filtrar por fecha
  const filteredGarantias = filterByDateRange(garantias, filters);

  // Procesar datos según el tipo de filtro
  let result;
  if (filters.type === "días") {
    result = processGarantiasByDays(
      filteredGarantias,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    result = processGarantiasByWeeks(
      filteredGarantias,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    result = processGarantiasByMonths(filteredGarantias, filters.year);
  } else if (filters.type === "años") {
    result = processGarantiasByYears(filteredGarantias);
  } else {
    // Fallback para filtros antiguos
    result = processGarantiasByMonths(filteredGarantias, filters.year);
  }
  return result;
};

/**
 * Procesa garantías agrupándolas por días del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por días
 */
const processGarantiasByDays = (records, month, year) => {
  const days = {};

  // Inicializar días en 0 hasta hoy (si es mes actual) o hasta fin de mes
  const maxDay = getMaxDayToShow(month, year);
  for (let i = 1; i <= maxDay; i++) {
    days[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    const day = getDayFromDateSafe(fecha);
    if (day === 0) return; // Fecha inválida

    days[day] += 1; // Contar garantías
  });

  return Object.entries(days)
    .map(([day, count]) => ({
      name: `Día ${day}`,
      garantias: count,
      cantidad: count,
    }));
};

/**
 * Procesa garantías agrupándolas por semanas del mes
 * @param {Array} records - Registros filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por semanas
 */
const processGarantiasByWeeks = (records, month, year) => {
  const weeks = {
    "Semana 1": 0,
    "Semana 2": 0,
    "Semana 3": 0,
    "Semana 4": 0,
  };

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let day;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [dayStr] = fecha.split("-");
      day = parseInt(dayStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      day = recordDate.getDate();
    }

    // Determinar la semana basada en el día del mes
    let week;
    if (day <= 7) week = "Semana 1";
    else if (day <= 14) week = "Semana 2";
    else if (day <= 21) week = "Semana 3";
    else week = "Semana 4";

    weeks[week] += 1; // Contar garantías, no sumar valores
  });

  return Object.entries(weeks).map(([week, count]) => ({
    name: `${week}|${getWeekRangeText(week, month, year)}`,
    garantias: count,
    cantidad: count,
  }));
};

/**
 * Procesa garantías agrupándolas por meses del año
 * @param {Array} records - Registros filtrados
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por meses
 */
const processGarantiasByMonths = (records, year) => {
  const months = {};

  // Inicializar todos los meses en 0
  for (let i = 1; i <= 12; i++) {
    months[i] = 0;
  }

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let month;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, monthStr] = fecha.split("-");
      month = parseInt(monthStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      month = recordDate.getMonth() + 1;
    }

    months[month] += 1; // Contar garantías
  });

  return Object.entries(months)
    .filter(([month, count]) => count > 0) // Solo mostrar meses con datos
    .map(([month, count]) => ({
      name: getMonthName(parseInt(month)),
      garantias: count,
      cantidad: count,
    }));
};

/**
 * Procesa garantías agrupándolas por años
 * @param {Array} records - Registros filtrados
 * @returns {Array} Datos agrupados por años
 */
const processGarantiasByYears = (records) => {
  const years = {};

  records.forEach((record) => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let year;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, , yearStr] = fecha.split("-");
      year = parseInt(yearStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      year = recordDate.getFullYear();
    }

    if (!years[year]) {
      years[year] = 0;
    }
    years[year] += 1; // Contar garantías
  });

  return Object.entries(years)
    .filter(([year, count]) => count > 0) // Solo mostrar años con datos
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)) // Ordenar por año
    .map(([year, count]) => ({
      name: year,
      garantias: count,
      cantidad: count,
    }));
};

/**
 * Procesa datos para obtener facturas y deudas
 * @param {Object} facturas - Datos de la tabla facturas
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de facturas y deudas
 */
export const processFacturasData = (facturas = {}, filters = {}) => {
  // Procesar datos de facturas (estructura plana)
  const facturasRecords = Object.entries(facturas).map(([id, record]) => ({
    ...record,
    id,
    source: "facturas",
  }));

  const facturasEmitidas = facturasRecords.filter((record) => {
    const pago = (record.pago || "").toLowerCase().trim();
    const deuda = parseFloat(record.deuda) || 0;

    return (!pago || pago === "debe" || pago === "pendiente") && deuda > 0;
  });

  // Filtrar por fecha usando fechaEmision
  const filteredFacturas = filterFacturasByDateRange(facturasEmitidas, filters);

  // Procesar datos según el tipo de filtro
  let result;
  if (filters.type === "días") {
    result = processFacturasByDays(
      filteredFacturas,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    result = processFacturasByWeeks(
      filteredFacturas,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    result = processFacturasByMonths(filteredFacturas, filters.year);
  } else if (filters.type === "años") {
    result = processFacturasByYears(filteredFacturas);
  } else {
    // Fallback para filtros antiguos
    result = processFacturasByMonths(filteredFacturas, filters.year);
  }
  return result;
};

/**
 * Filtra facturas por rango de fechas usando fechaEmision
 * @param {Array} records - Array de facturas
 * @param {Object} filters - Filtros con type, month, year
 * @returns {Array} Facturas filtradas
 */
const filterFacturasByDateRange = (records, filters) => {
  return records.filter((record) => {
    const fecha = record.fechaEmision;
    if (!fecha) return false;

    let recordYear, recordMonth;

    // Manejar formato YYYY-MM-DD (usado en fechaEmision)
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [year, month] = fecha.split("-");
      recordYear = parseInt(year);
      recordMonth = parseInt(month);
    } else {
      // Formato de fecha estándar como fallback
      try {
        const recordDate = new Date(fecha);
        recordYear = recordDate.getFullYear();
        recordMonth = recordDate.getMonth() + 1;
      } catch {
        return false;
      }
    }

    // Para filtro de años, no filtrar por año específico
    if (filters.type === "años") {
      return true; // Incluir todos los años
    }

    // Filtrar por año para filtros de días, semanas y meses
    if (filters.year && recordYear !== filters.year) {
      return false;
    }

    // Si es filtro por días, incluir todos los días del mes seleccionado
    if (filters.type === "días" && filters.month) {
      return recordMonth === filters.month;
    }

    // Si es filtro por semanas, también filtrar por mes
    if (filters.type === "semanas" && filters.month) {
      return recordMonth === filters.month;
    }

    return true;
  });
};

/**
 * Procesa facturas agrupándolas por días del mes
 * @param {Array} records - Facturas filtradas
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por días
 */
const processFacturasByDays = (records, month, year) => {
  const days = {};

  // Inicializar días en 0 hasta hoy (si es mes actual) o hasta fin de mes
  const maxDay = getMaxDayToShow(month, year);
  for (let i = 1; i <= maxDay; i++) {
    days[i] = { count: 0, deuda: 0 };
  }

  records.forEach((record) => {
    const fecha = record.fechaEmision;
    if (!fecha) return;

    const day = getDayFromFacturaDate(fecha);
    if (day === 0) return; // Fecha inválida

    const deuda = parseFloat(record.deuda) || 0;

    days[day].count += 1;
    days[day].deuda += deuda;
  });

  return Object.entries(days)
    .map(([day, data]) => ({
      name: `Día ${day}`,
      facturas: data.count,
      deuda: data.deuda,
      cantidad: data.count,
    }));
};

/**
 * Procesa facturas agrupándolas por semanas del mes
 * @param {Array} records - Facturas filtradas
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por semanas
 */
const processFacturasByWeeks = (records, month, year) => {
  const weeks = {
    "Semana 1": { count: 0, deuda: 0 },
    "Semana 2": { count: 0, deuda: 0 },
    "Semana 3": { count: 0, deuda: 0 },
    "Semana 4": { count: 0, deuda: 0 },
  };

  records.forEach((record) => {
    const fecha = record.fechaEmision;
    if (!fecha) return;

    let day;
    // Manejar formato YYYY-MM-DD
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, , dayStr] = fecha.split("-");
      day = parseInt(dayStr);
    } else {
      // Formato de fecha estándar como fallback
      try {
        const recordDate = new Date(fecha);
        day = recordDate.getDate();
      } catch {
        return;
      }
    }

    const deuda = parseFloat(record.deuda) || 0;

    // Determinar la semana basada en el día del mes
    let week;
    if (day <= 7) week = "Semana 1";
    else if (day <= 14) week = "Semana 2";
    else if (day <= 21) week = "Semana 3";
    else week = "Semana 4";

    weeks[week].count += 1;
    weeks[week].deuda += deuda;
  });

  return Object.entries(weeks).map(([week, data]) => ({
    name: `${week}|${getWeekRangeText(week, month, year)}`,
    facturas: data.count,
    deuda: data.deuda,
    cantidad: data.count,
  }));
};

/**
 * Procesa facturas agrupándolas por meses del año
 * @param {Array} records - Facturas filtradas
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por meses
 */
const processFacturasByMonths = (records, year) => {
  const months = {};

  // Inicializar todos los meses en 0
  for (let i = 1; i <= 12; i++) {
    months[i] = { count: 0, deuda: 0 };
  }

  records.forEach((record) => {
    const fecha = record.fechaEmision;
    if (!fecha) return;

    let month;
    // Manejar formato YYYY-MM-DD
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [, monthStr] = fecha.split("-");
      month = parseInt(monthStr);
    } else {
      // Formato de fecha estándar como fallback
      try {
        const recordDate = new Date(fecha);
        month = recordDate.getMonth() + 1;
      } catch {
        return;
      }
    }

    const deuda = parseFloat(record.deuda) || 0;

    months[month].count += 1;
    months[month].deuda += deuda;
  });

  return Object.entries(months)
    .filter(([month, data]) => data.count > 0) // Solo mostrar meses con datos
    .map(([month, data]) => ({
      name: getMonthName(parseInt(month)),
      facturas: data.count,
      deuda: data.deuda,
      cantidad: data.count,
    }));
};

/**
 * Procesa facturas agrupándolas por años
 * @param {Array} records - Facturas filtradas
 * @returns {Array} Datos agrupados por años
 */
const processFacturasByYears = (records) => {
  const years = {};

  records.forEach((record) => {
    const fecha = record.fechaEmision;
    if (!fecha) return;

    let year;
    // Manejar formato YYYY-MM-DD
    if (fecha.includes("-") && fecha.split("-").length === 3) {
      const [yearStr] = fecha.split("-");
      year = parseInt(yearStr);
    } else {
      // Formato de fecha estándar como fallback
      try {
        const recordDate = new Date(fecha);
        year = recordDate.getFullYear();
      } catch {
        return;
      }
    }

    const deuda = parseFloat(record.deuda) || 0;

    if (!years[year]) {
      years[year] = { count: 0, deuda: 0 };
    }
    years[year].count += 1;
    years[year].deuda += deuda;
  });

  return Object.entries(years)
    .filter(([year, data]) => data.count > 0) // Solo mostrar años con datos
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB)) // Ordenar por año
    .map(([year, data]) => ({
      name: year,
      facturas: data.count,
      deuda: data.deuda,
      cantidad: data.count,
    }));
};

/**
 * Convierte código de banco a valor de filtro para búsqueda
 * @param {string} bankCode - Código del banco
 * @returns {string} Valor para filtrar
 */
const getBankFilterValue = (bankCode) => {
  const bankFilters = {
    aruba_bank: "aruba",
    caribbean_mercantile: "caribbean",
    rbc_royal: "rbc",
  };
  return bankFilters[bankCode] || bankCode;
};

/**
 * Formatea números como moneda
 * @param {number} value - Valor numérico
 * @returns {string} Valor formateado como moneda
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "AWG",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

/**
 * Formatea números para mostrar en tooltips
 * @param {number} value - Valor numérico
 * @param {number} cantidad - Cantidad de registros
 * @returns {string} Texto formateado para tooltip
 */
export const formatTooltip = (value, cantidad) => {
  return `${formatCurrency(value)} (${cantidad} registros)`;
};

/**
 * Procesa datos para obtener total de gastos
 * @param {Object} gastos - Datos de la tabla gastos
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de gastos
 */
export const processGastosData = (gastos = {}, filters = {}) => {

  // Convertir el objeto de gastos a array si no es array
  let gastosArray;
  if (Array.isArray(gastos)) {
    gastosArray = gastos;
  } else {
    gastosArray = Object.entries(gastos).map(([id, gasto]) => ({
      ...gasto,
      id,
    }));
  }

  // Filtrar gastos por fecha
  const filteredGastos = filterGastosByDateRange(gastosArray, filters);

  // Procesar datos según el tipo de filtro (días, semanas, meses o años)
  let processedData;
  if (filters.type === "días") {
    processedData = processGastosByDays(
      filteredGastos,
      filters.month,
      filters.year
    );
  } else if (filters.type === "semanas") {
    processedData = processGastosByWeeks(
      filteredGastos,
      filters.month,
      filters.year
    );
  } else if (filters.type === "meses") {
    processedData = processGastosByMonths(filteredGastos, filters.year);
  } else {
    processedData = processGastosByYears(filteredGastos);
  }

  return processedData;
}

/**
 * Procesa datos para obtener total de ingresos (transferencias + efectivo + intercambio)
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de ingresos totales
 */
export const processIngresosTotalesData = (
  registroFechas = {},
  dataTable = {},
  filters = {}
) => {
  // Obtener datos de cada tipo de ingreso
  const transferenciasData = processTransferenciasData(
    registroFechas,
    dataTable,
    filters
  );
  const efectivoData = processEfectivoData(registroFechas, dataTable, filters);
  const intercambiosData = processIntercambiosData(
    registroFechas,
    dataTable,
    filters
  );

  // Combinar todos los datos por período
  const periodosMap = new Map();

  // Agregar transferencias
  transferenciasData.forEach((item) => {
    const key = item.name;
    if (!periodosMap.has(key)) {
      periodosMap.set(key, {
        name: key,
        transferencias: 0,
        efectivo: 0,
        intercambios: 0,
        total: 0,
      });
    }
    const periodo = periodosMap.get(key);
    periodo.transferencias = item.valor || 0;
  });

  // Agregar efectivo
  efectivoData.forEach((item) => {
    const key = item.name;
    if (!periodosMap.has(key)) {
      periodosMap.set(key, {
        name: key,
        transferencias: 0,
        efectivo: 0,
        intercambios: 0,
        total: 0,
      });
    }
    const periodo = periodosMap.get(key);
    periodo.efectivo = item.valor || 0;
  });

  // Agregar intercambios
  intercambiosData.forEach((item) => {
    const key = item.name;
    if (!periodosMap.has(key)) {
      periodosMap.set(key, {
        name: key,
        transferencias: 0,
        efectivo: 0,
        intercambios: 0,
        total: 0,
      });
    }
    const periodo = periodosMap.get(key);
    periodo.intercambios = item.valor || 0;
  });

  // Calcular totales y retornar array
  return Array.from(periodosMap.values()).map((periodo) => ({
    ...periodo,
    total: periodo.transferencias + periodo.efectivo + periodo.intercambios,
  }));
};

/**
 * Procesa datos para obtener ganancia o pérdida (ingresos - gastos)
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} gastos - Datos de la tabla gastos
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para gráfica de ganancia/pérdida
 */
export const processGananciaPerdidaData = (
  registroFechas = {},
  dataTable = {},
  gastos = {},
  filters = {}
) => {
  // Obtener datos de ingresos y gastos
  const ingresosData = processIngresosTotalesData(
    registroFechas,
    dataTable,
    filters
  );
  const gastosData = processGastosData(gastos, filters);

  // Combinar datos por período
  const periodosMap = new Map();

  // Agregar ingresos
  ingresosData.forEach((item) => {
    periodosMap.set(item.name, {
      name: item.name,
      ingresos: item.total,
      gastos: 0,
      ganancia: 0,
      esGanancia: true,
    });
  });

  // Agregar gastos
  gastosData.forEach((item) => {
    const key = item.name;
    if (!periodosMap.has(key)) {
      periodosMap.set(key, {
        name: key,
        ingresos: 0,
        gastos: 0,
        ganancia: 0,
        esGanancia: true,
      });
    }
    const periodo = periodosMap.get(key);
    periodo.gastos = item.total || 0;
  });

  // Calcular ganancia/pérdida
  return Array.from(periodosMap.values()).map((periodo) => {
    const ganancia = periodo.ingresos - periodo.gastos;
    return {
      ...periodo,
      ganancia: Math.abs(ganancia),
      esGanancia: ganancia >= 0,
    };
  });
};

/**
 * Filtra gastos por rango de fechas usando fecha del gasto
 * @param {Array} records - Array de gastos
 * @param {Object} filters - Filtros con type, month, year
 * @returns {Array} Gastos filtrados
 */
const filterGastosByDateRange = (records, filters) => {

  const filteredResults = records.filter((record) => {
    const fecha = record.fecha;

    if (!fecha) {
      return false;
    }

    let gastoDate;
    let gastoMonth, gastoYear;

    try {
      // Intentar múltiples formatos de fecha
      if (typeof fecha === "string") {
        if (fecha.includes("-") && fecha.split("-").length === 3) {
          // Formato DD-MM-YYYY o YYYY-MM-DD
          const parts = fecha.split("-");
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            gastoDate = new Date(
              parseInt(parts[0]),
              parseInt(parts[1]) - 1,
              parseInt(parts[2])
            );
          } else {
            // DD-MM-YYYY
            gastoDate = new Date(
              parseInt(parts[2]),
              parseInt(parts[1]) - 1,
              parseInt(parts[0])
            );
          }
        } else {
          // Intentar parseo directo
          gastoDate = new Date(fecha);
        }
      } else if (fecha instanceof Date) {
        gastoDate = fecha;
      } else {
        // Intentar convertir a Date
        gastoDate = new Date(fecha);
      }

      if (isNaN(gastoDate.getTime())) {
        return false;
      }

      gastoMonth = gastoDate.getMonth() + 1;
      gastoYear = gastoDate.getFullYear();

    } catch (error) {
      return false;
    }

    if (filters.type === "días") {
      const gastoDay = gastoDate.getDate();
      const shouldInclude =
        gastoMonth === filters.month && 
        gastoYear === filters.year && 
        gastoDay === filters.day;
      return shouldInclude;
    } else if (filters.type === "semanas") {
      const shouldInclude =
        gastoMonth === filters.month && gastoYear === filters.year;
      return shouldInclude;
    } else if (filters.type === "meses") {
      const shouldInclude = gastoYear === filters.year;
      return shouldInclude;
    } else {
      return true;
    }
  });

  return filteredResults;
};

/**
 * Procesa gastos agrupándolos por días del mes
 * @param {Array} records - Gastos filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por días
 */
const processGastosByDays = (records, month, year) => {
  const days = {};

  // Inicializar días en 0 hasta hoy (si es mes actual) o hasta fin de mes
  const maxDay = getMaxDayToShow(month, year);
  for (let i = 1; i <= maxDay; i++) {
    days[i] = 0;
  }

  records.forEach((gasto) => {
    const fecha = gasto.fecha;
    const monto = parseFloat(gasto.monto) || 0;

    if (!fecha) {
      return;
    }

    let gastoDate;
    let gastoMonth, gastoYear, day;
    
    try {
      if (typeof fecha === "string") {
        if (fecha.includes("-") && fecha.split("-").length === 3) {
          const parts = fecha.split("-");
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            gastoYear = parseInt(parts[0]);
            gastoMonth = parseInt(parts[1]);
            day = parseInt(parts[2]);
            gastoDate = createLocalDate(gastoYear, gastoMonth, day);
          } else {
            // DD-MM-YYYY
            day = parseInt(parts[0]);
            gastoMonth = parseInt(parts[1]);
            gastoYear = parseInt(parts[2]);
            gastoDate = createLocalDate(gastoYear, gastoMonth, day);
          }
        } else {
          gastoDate = new Date(fecha);
          gastoMonth = gastoDate.getMonth() + 1;
          gastoYear = gastoDate.getFullYear();
          day = gastoDate.getDate();
        }
      } else {
        gastoDate = new Date(fecha);
        gastoMonth = gastoDate.getMonth() + 1;
        gastoYear = gastoDate.getFullYear();
        day = gastoDate.getDate();
      }

      if (isNaN(gastoDate.getTime())) {
        return;
      }
    } catch (error) {
      return;
    }

    if (gastoMonth === month && gastoYear === year) {
      days[day] += monto;
    }
  });

  return Object.entries(days)
    .map(([day, total]) => ({
      name: `Día ${day}`,
      total: total,
      cantidad: records.filter((r) => {
        const fecha = r.fecha;
        if (!fecha) return false;

        try {
          let gastoDate;
          let gastoMonth, gastoYear, gastoDay;
          
          if (typeof fecha === "string") {
            if (fecha.includes("-") && fecha.split("-").length === 3) {
              const parts = fecha.split("-");
              if (parts[0].length === 4) {
                // YYYY-MM-DD
                gastoYear = parseInt(parts[0]);
                gastoMonth = parseInt(parts[1]);
                gastoDay = parseInt(parts[2]);
                gastoDate = createLocalDate(gastoYear, gastoMonth, gastoDay);
              } else {
                // DD-MM-YYYY
                gastoDay = parseInt(parts[0]);
                gastoMonth = parseInt(parts[1]);
                gastoYear = parseInt(parts[2]);
                gastoDate = createLocalDate(gastoYear, gastoMonth, gastoDay);
              }
            } else {
              gastoDate = new Date(fecha);
              gastoMonth = gastoDate.getMonth() + 1;
              gastoYear = gastoDate.getFullYear();
              gastoDay = gastoDate.getDate();
            }
          } else {
            gastoDate = new Date(fecha);
            gastoMonth = gastoDate.getMonth() + 1;
            gastoYear = gastoDate.getFullYear();
            gastoDay = gastoDate.getDate();
          }

          if (isNaN(gastoDate.getTime())) return false;

          return gastoMonth === month && gastoYear === year && gastoDay === parseInt(day);
        } catch {
          return false;
        }
      }).length,
    }));
};

/**
 * Procesa gastos agrupándolos por semanas del mes
 * @param {Array} records - Gastos filtrados
 * @param {number} month - Mes seleccionado
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por semanas
 */
const processGastosByWeeks = (records, month, year) => {

  const weeks = {
    "Semana 1": 0,
    "Semana 2": 0,
    "Semana 3": 0,
    "Semana 4": 0,
  };

  records.forEach((gasto, index) => {

    const fecha = gasto.fecha;
    const monto = parseFloat(gasto.monto) || 0;

    if (!fecha) {
      return;
    }

    let gastoDate;
    try {
      if (typeof fecha === "string") {
        if (fecha.includes("-") && fecha.split("-").length === 3) {
          const parts = fecha.split("-");
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            gastoDate = new Date(
              parseInt(parts[0]),
              parseInt(parts[1]) - 1,
              parseInt(parts[2])
            );
          } else {
            // DD-MM-YYYY
            gastoDate = new Date(
              parseInt(parts[2]),
              parseInt(parts[1]) - 1,
              parseInt(parts[0])
            );
          }
        } else {
          gastoDate = new Date(fecha);
        }
      } else {
        gastoDate = new Date(fecha);
      }

      if (isNaN(gastoDate.getTime())) {
        console.error("Fecha inválida:", fecha);
        return;
      }
    } catch (error) {
      console.error("Error parseando fecha:", error);
      return;
    }

    const gastoMonth = gastoDate.getMonth() + 1;
    const gastoYear = gastoDate.getFullYear();
    const day = gastoDate.getDate();


    if (gastoMonth === month && gastoYear === year) {
      let weekKey;
      if (day <= 7) weekKey = "Semana 1";
      else if (day <= 14) weekKey = "Semana 2";
      else if (day <= 21) weekKey = "Semana 3";
      else weekKey = "Semana 4";

      weeks[weekKey] += monto;
    } else {
      console.error(
        `Gasto no coincide con filtro: ${gastoMonth}/${gastoYear} vs ${month}/${year}`
      );
    }
  });

  const result = Object.entries(weeks).map(([week, total]) => ({
    name: `${week}|${getWeekRangeText(week, month, year)}`,
    total: total,
    cantidad: records.filter((r) => {
      const fecha = r.fecha;
      if (!fecha) return false;

      try {
        let gastoDate;
        if (typeof fecha === "string") {
          if (fecha.includes("-") && fecha.split("-").length === 3) {
            const parts = fecha.split("-");
            if (parts[0].length === 4) {
              gastoDate = new Date(
                parseInt(parts[0]),
                parseInt(parts[1]) - 1,
                parseInt(parts[2])
              );
            } else {
              gastoDate = new Date(
                parseInt(parts[2]),
                parseInt(parts[1]) - 1,
                parseInt(parts[0])
              );
            }
          } else {
            gastoDate = new Date(fecha);
          }
        } else {
          gastoDate = new Date(fecha);
        }

        if (isNaN(gastoDate.getTime())) return false;

        const gastoMonth = gastoDate.getMonth() + 1;
        const gastoYear = gastoDate.getFullYear();
        const day = gastoDate.getDate();

        if (gastoMonth === month && gastoYear === year) {
          let weekRange;
          if (day <= 7) weekRange = "Semana 1";
          else if (day <= 14) weekRange = "Semana 2";
          else if (day <= 21) weekRange = "Semana 3";
          else weekRange = "Semana 4";

          return weekRange === week;
        }
        return false;
      } catch {
        return false;
      }
    }).length,
  }));

  return result;
};

/**
 * Procesa gastos agrupándolos por meses del año
 * @param {Array} records - Gastos filtrados
 * @param {number} year - Año seleccionado
 * @returns {Array} Datos agrupados por meses
 */
const processGastosByMonths = (records, year) => {
  const months = {};

  // Inicializar todos los meses en 0
  for (let i = 1; i <= 12; i++) {
    months[i] = 0;
  }

  records.forEach((gasto) => {
    const fecha = gasto.fecha;
    if (!fecha) return;

    let gastoDate;
    try {
      const [day, month_str, year_str] = fecha.split("-");
      gastoDate = new Date(
        parseInt(year_str),
        parseInt(month_str) - 1,
        parseInt(day)
      );
    } catch {
      return;
    }

    const gastoYear = gastoDate.getFullYear();
    if (gastoYear === year) {
      const month = gastoDate.getMonth() + 1;
      months[month] += parseFloat(gasto.monto) || 0;
    }
  });

  return Object.entries(months)
    .filter(([month, total]) => total > 0)
    .map(([month, total]) => ({
      name: getMonthName(parseInt(month)),
      total: total,
      cantidad: records.filter((r) => {
        const fecha = r.fecha;
        if (!fecha) return false;

        try {
          const [day, month_str, year_str] = fecha.split("-");
          const gastoDate = new Date(
            parseInt(year_str),
            parseInt(month_str) - 1,
            parseInt(day)
          );
          const gastoYear = gastoDate.getFullYear();
          const gastoMonth = gastoDate.getMonth() + 1;

          return gastoYear === year && gastoMonth === parseInt(month);
        } catch {
          return false;
        }
      }).length,
    }));
};

/**
 * Procesa gastos agrupándolos por años
 * @param {Array} records - Gastos filtrados
 * @returns {Array} Datos agrupados por años
 */
const processGastosByYears = (records) => {
  const years = {};

  records.forEach((gasto) => {
    const fecha = gasto.fecha;
    if (!fecha) return;

    let gastoDate;
    try {
      const [day, month_str, year_str] = fecha.split("-");
      gastoDate = new Date(
        parseInt(year_str),
        parseInt(month_str) - 1,
        parseInt(day)
      );
    } catch {
      return;
    }

    const year = gastoDate.getFullYear();
    if (!years[year]) {
      years[year] = 0;
    }
    years[year] += parseFloat(gasto.monto) || 0;
  });

  return Object.entries(years)
    .filter(([year, total]) => total > 0)
    .map(([year, total]) => ({
      name: year,
      total: total,
      cantidad: records.filter((r) => {
        const fecha = r.fecha;
        if (!fecha) return false;

        try {
          const [day, month_str, year_str] = fecha.split("-");
          const gastoDate = new Date(
            parseInt(year_str),
            parseInt(month_str) - 1,
            parseInt(day)
          );
          return gastoDate.getFullYear() === parseInt(year);
        } catch {
          return false;
        }
      }).length,
    }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));
};

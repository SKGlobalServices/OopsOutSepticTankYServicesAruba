/**
 * Utilidades para procesar datos de Firebase para las gráficas del dashboard
 */
import { getMonthName } from './dateUtils';

/**
 * Normaliza la forma de pago de un registro
 * @param {Object} record - Registro de la base de datos
 * @returns {string} Forma de pago normalizada en minúsculas
 */
const normalizeFormaPago = (record) => {
  return (record.formadepago || record.metododepago || '').toLowerCase().trim();
};

/**
 * Procesa datos de registrofechas y data para obtener transferencias
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (banco, type, month, year)
 * @returns {Array} Array de datos procesados para line chart
 */
export const processTransferenciasData = (registroFechas = {}, dataTable = {}, filters = {}) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: 'registrofechas'
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: 'data'
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Debug: Log para ver qué datos tenemos
  console.log('🔍 Debug Transferencias:', {
    registroFechasCount: Object.keys(registroFechas).length,
    dataTableCount: Object.keys(dataTable).length,
    registroRecordsCount: registroRecords.length,
    dataRecordsCount: dataRecords.length,
    allRecordsCount: allRecords.length,
    filters
  });

  // Filtrar por transferencias
  const transferencias = allRecords.filter(record => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === 'transferencia';
  });

  console.log('🔍 Transferencias encontradas:', transferencias.length, transferencias.slice(0, 3));

  // Filtrar por banco si no es "todos"
  let filteredTransferencias = transferencias;
  if (filters.banco && filters.banco !== 'todos') {
    filteredTransferencias = transferencias.filter(record => {
      const banco = record.banco || '';
      return banco.toLowerCase().includes(getBankFilterValue(filters.banco));
    });
    console.log('🔍 Después de filtrar por banco:', filteredTransferencias.length);
  }

  // Filtrar por fecha
  filteredTransferencias = filterByDateRange(filteredTransferencias, filters);
  console.log('🔍 Después de filtrar por fecha:', filteredTransferencias.length);

  // Procesar datos según el tipo de filtro (mes o año)
  if (filters.type === 'mes') {
    return processDataByWeeks(filteredTransferencias, filters.month, filters.year);
  } else {
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
export const processEfectivoData = (registroFechas = {}, dataTable = {}, filters = {}) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: 'registrofechas'
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: 'data'
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Debug: Log para ver qué datos tenemos
  console.log('🔍 Debug Efectivo - Datos:', {
    registroFechasCount: Object.keys(registroFechas).length,
    dataTableCount: Object.keys(dataTable).length,
    registroRecordsCount: registroRecords.length,
    dataRecordsCount: dataRecords.length,
    allRecordsCount: allRecords.length,
    filters
  });

  // Filtrar por efectivo
  const efectivo = allRecords.filter(record => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === 'efectivo';
  });

  console.log('🔍 Efectivo encontrado:', efectivo.length, efectivo.slice(0, 3));

  // Filtrar por fecha
  const filteredEfectivo = filterByDateRange(efectivo, filters);
  console.log('🔍 Efectivo después de filtrar por fecha:', filteredEfectivo.length);

  // Procesar datos según el tipo de filtro
  let result;
  if (filters.type === 'mes') {
    result = processDataByWeeks(filteredEfectivo, filters.month, filters.year);
  } else {
    result = processDataByMonths(filteredEfectivo, filters.year);
  }
  
  console.log('🔍 Resultado final efectivo:', result);
  return result;
};

/**
 * Procesa datos para obtener intercambios (simple bar chart)
 * @param {Object} registroFechas - Datos de la tabla registrofechas
 * @param {Object} dataTable - Datos de la tabla data
 * @param {Object} filters - Filtros aplicados (type, month, year)
 * @returns {Array} Array de datos procesados para simple bar chart
 */
export const processIntercambiosData = (registroFechas = {}, dataTable = {}, filters = {}) => {
  // Procesar datos de registrofechas (estructura anidada por fecha)
  const registroRecords = [];
  Object.entries(registroFechas).forEach(([fecha, registros]) => {
    Object.entries(registros).forEach(([id, record]) => {
      registroRecords.push({
        ...record,
        id,
        fecha,
        source: 'registrofechas'
      });
    });
  });

  // Procesar datos de data (estructura plana)
  const dataRecords = Object.entries(dataTable).map(([id, record]) => ({
    ...record,
    id,
    source: 'data'
  }));

  // Combinar todos los registros
  const allRecords = [...registroRecords, ...dataRecords];

  // Filtrar por intercambio
  const intercambios = allRecords.filter(record => {
    const formaPago = normalizeFormaPago(record);
    return formaPago === 'intercambio';
  });

  // Filtrar por fecha
  const filteredIntercambios = filterByDateRange(intercambios, filters);

  // Procesar datos según el tipo de filtro
  if (filters.type === 'mes') {
    return processDataByWeeks(filteredIntercambios, filters.month, filters.year);
  } else {
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
  return records.filter(record => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return false;

    let recordYear, recordMonth;

    // Manejar formato DD-MM-YYYY (usado en registrofechas)
    if (fecha.includes('-') && fecha.split('-').length === 3) {
      const [, month, year] = fecha.split('-');
      recordYear = parseInt(year);
      recordMonth = parseInt(month);
    } else {
      // Manejar formato de fecha estándar (usado en data)
      const recordDate = new Date(fecha);
      recordYear = recordDate.getFullYear();
      recordMonth = recordDate.getMonth() + 1;
    }

    // Filtrar por año
    if (filters.year && recordYear !== filters.year) {
      return false;
    }

    // Si es filtro por mes, también filtrar por mes
    if (filters.type === 'mes' && filters.month) {
      return recordMonth === filters.month;
    }

    return true;
  });
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
    'Semana 1': 0,
    'Semana 2': 0,
    'Semana 3': 0,
    'Semana 4': 0
  };

  records.forEach(record => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let day;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes('-') && fecha.split('-').length === 3) {
      const [dayStr] = fecha.split('-');
      day = parseInt(dayStr);
    } else {
      // Manejar formato de fecha estándar
      const recordDate = new Date(fecha);
      day = recordDate.getDate();
    }

    const valor = parseFloat(record.valor) || 0;

    // Determinar la semana basada en el día del mes
    let week;
    if (day <= 7) week = 'Semana 1';
    else if (day <= 14) week = 'Semana 2';
    else if (day <= 21) week = 'Semana 3';
    else week = 'Semana 4';

    weeks[week] += valor;
  });

  return Object.entries(weeks).map(([week, value]) => ({
    name: week,
    valor: value,
    cantidad: records.filter(r => {
      const fecha = r.fecha || r.fechaEjecucion;
      if (!fecha) return false;
      
      let day;
      if (fecha.includes('-') && fecha.split('-').length === 3) {
        const [dayStr] = fecha.split('-');
        day = parseInt(dayStr);
      } else {
        const recordDate = new Date(fecha);
        day = recordDate.getDate();
      }
      
      return (
        (week === 'Semana 1' && day <= 7) ||
        (week === 'Semana 2' && day > 7 && day <= 14) ||
        (week === 'Semana 3' && day > 14 && day <= 21) ||
        (week === 'Semana 4' && day > 21)
      );
    }).length
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

  records.forEach(record => {
    const fecha = record.fecha || record.fechaEjecucion;
    if (!fecha) return;

    let month;
    // Manejar formato DD-MM-YYYY
    if (fecha.includes('-') && fecha.split('-').length === 3) {
      const [, monthStr] = fecha.split('-');
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
      cantidad: records.filter(r => {
        const fecha = r.fecha || r.fechaEjecucion;
        if (!fecha) return false;
        
        let recordMonth;
        if (fecha.includes('-') && fecha.split('-').length === 3) {
          const [, monthStr] = fecha.split('-');
          recordMonth = parseInt(monthStr);
        } else {
          const recordDate = new Date(fecha);
          recordMonth = recordDate.getMonth() + 1;
        }
        
        return recordMonth === parseInt(month);
      }).length
    }));
};

/**
 * Convierte código de banco a valor de filtro para búsqueda
 * @param {string} bankCode - Código del banco
 * @returns {string} Valor para filtrar
 */
const getBankFilterValue = (bankCode) => {
  const bankFilters = {
    'aruba_bank': 'aruba',
    'caribbean_mercantile': 'caribbean',
    'rbc_royal': 'rbc'
  };
  return bankFilters[bankCode] || bankCode;
};

/**
 * Formatea números como moneda
 * @param {number} value - Valor numérico
 * @returns {string} Valor formateado como moneda
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'AWG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
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

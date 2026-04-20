import { useCallback, useState } from "react";
import {
  normalizeTextValue,
  parseInformeDate,
} from "../utils/informeUtils";

// Valores por defecto para los filtros comunes del informe.
// Mantienen el comportamiento actual: listado centrado en efectivo y sin rango de fechas activo.
const DEFAULT_INFORME_FILTERS = {
  realizadopor: [],
  direccion: [],
  metododepago: "efectivo",
  fechaInicio: null,
  fechaFin: null,
};

// Comprueba si un valor del registro coincide con una lista de seleccion múltiple.
const recordMatchesSelectedValues = (recordValue, selectedValues) => {
  if (selectedValues.length === 0) return true;

  const normalizedRecordValue = normalizeTextValue(recordValue);
  return selectedValues.some((filterValue) => {
    if (filterValue === "__EMPTY__") {
      return normalizedRecordValue === "";
    }

    return normalizedRecordValue === filterValue;
  });
};

// Verifica si el registro cae dentro del rango de fechas actual.
const recordMatchesDateRange = (record, filters) => {
  if (!filters.fechaInicio || !filters.fechaFin) return true;

  const recordDate = parseInformeDate(record.fecha);
  if (!recordDate) return false;

  return !(recordDate < filters.fechaInicio || recordDate > filters.fechaFin);
};

// Ordena los registros de forma ascendente por fecha y luego por timestamp.
const sortRecordsByDateAsc = (records) => {
  return [...records].sort((a, b) => {
    const dateA = parseInformeDate(a.fecha);
    const dateB = parseInformeDate(b.fecha);

    if (dateA && dateB && dateA.getTime() !== dateB.getTime()) {
      return dateA - dateB;
    }

    return (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0);
  });
};

// Ordena en forma descendente reutilizando la misma regla base de fecha.
const sortRecordsByDateDesc = (records) => {
  return sortRecordsByDateAsc(records).reverse();
};

// Hook compartido para el estado y la logica de filtrado del informe.
// La idea es que los componentes solo pidan "aplicar filtros" y no reescriban reglas.
export const useInformeFilters = () => {
  const [filters, setFilters] = useState(DEFAULT_INFORME_FILTERS);

  // Actualiza el rango de fechas con horas cerradas para no perder registros del dia.
  const handleDateRangeChange = useCallback((dates) => {
    const [start, end] = dates;

    setFilters((prev) => ({
      ...prev,
      fechaInicio: start
        ? new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
            0,
            0,
            0
          )
        : null,
      fechaFin: end
        ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59)
        : null,
    }));
  }, []);

  // Devuelve el estado de filtros a la configuracion inicial del modulo.
  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_INFORME_FILTERS });
  }, []);

  // Aplica filtros y ordena los registros con las mismas reglas en todas las pantallas.
  const filterRecords = useCallback(
    (records, options = {}) => {
      const {
        restrictToUserId = null,
        includeMethodFilter = true,
      } = options;

      const preparedRecords = Array.isArray(records) ? records : [];

      const filteredRecords = preparedRecords.filter((record) => {
        if (!record?.fecha || record.fecha === "Sin Fecha") return false;

        if (restrictToUserId && record.realizadopor !== restrictToUserId) {
          return false;
        }

        if (!recordMatchesDateRange(record, filters)) return false;
        if (!recordMatchesSelectedValues(record.realizadopor, filters.realizadopor)) {
          return false;
        }
        if (!recordMatchesSelectedValues(record.direccion, filters.direccion)) {
          return false;
        }

        if (
          includeMethodFilter &&
          normalizeTextValue(filters.metododepago) &&
          normalizeTextValue(record.metododepago) !==
            normalizeTextValue(filters.metododepago)
        ) {
          return false;
        }

        return true;
      });

      return sortRecordsByDateDesc(filteredRecords);
    },
    [filters]
  );

  return {
    filters,
    setFilters,
    handleDateRangeChange,
    resetFilters,
    filterRecords,
    sortRecordsByDateAsc,
    sortRecordsByDateDesc,
  };
};
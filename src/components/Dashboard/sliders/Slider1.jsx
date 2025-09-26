import React, { useState } from "react";
import { GraficaGananciaPerdida } from "../charts/GraficaGananciaPerdida";
import { GraficaIngresosTotales } from "../charts/GraficaIngresosTotales";
import { GraficaTotalGastos } from "../charts/GraficaTotalGastos";
import {
  generateYears,
  getMonths,
  getCurrentMonth,
  getCurrentYear,
  getCurrentDay,
  getDaysInMonth,
  getFilterOptions,
} from "../../../utils/dateUtils";
import { useChartData } from "../../../utils/useChartData";
import { DebugChart } from "../charts/DebugChart";

export const Slider1 = () => {
  // Obtener datos para generar años dinámicos
  const { data, availableYears, loading } = useChartData();

  const [filterType, setFilterType] = useState("meses");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  // Eliminado selector de día: en modo "días" se muestran todos los días del mes

  const months = getMonths();
  // Usar años dinámicos si están disponibles, sino generar con datos disponibles
  const years =
    availableYears.length > 0
      ? availableYears.slice().reverse() // Años más recientes primero
      : generateYears(data.registroFechas, data.data);

  // En vista "días" se grafican todos los días del mes; no se requiere estado de día

  const filterOptions = getFilterOptions(filterType);

  const filters = {
    type: filterType,
    month: selectedMonth,
    year: selectedYear,
  };

  // Mostrar indicador de carga mientras se cargan los años
  if (loading && years.length === 0) {
    return (
      <div className="slider1-container">
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
            color: "#64748b",
          }}
        >
          Cargando años disponibles desde los datos...
        </div>
      </div>
    );
  }

  return (
    <div className="slider1-container">
      {/* Filtros Globales */}
      <div className="global-chart-filters">
        <div className="filter-group">
          <label>Tipo de Vista:</label>
          <select
            className="filter-select-global"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="días">Por Días</option>
            <option value="semanas">Por Semanas</option>
            <option value="meses">Por Meses</option>
            <option value="años">Por Años</option>
          </select>
        </div>

        {filterOptions.needsMonth && (
          <div className="filter-group">
            <label>Mes:</label>
            <select
              className="filter-select-global"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {filterOptions.needsYear && (
          <div className="filter-group">
            <label>Año:</label>
            <select
              className="filter-select-global"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* En modo días no se muestra selector de día; se grafican todos los días */}

        <div className="filter-group">
          <span
            style={{ fontSize: "12px", color: "#64748b", fontStyle: "italic" }}
          >
            {filterOptions.description}
          </span>
        </div>
      </div>

      {/* Gráficas */}
      <div className="charts-grid">
          <GraficaIngresosTotales filters={filters} />

          <GraficaTotalGastos filters={filters} />

          <GraficaGananciaPerdida filters={filters} />
      </div>
    </div>
  );
};

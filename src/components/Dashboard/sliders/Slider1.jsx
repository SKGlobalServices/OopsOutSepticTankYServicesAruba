import React, { useState } from "react";
import { GraficaGananciaPerdida } from "../charts/GraficaGananciaPerdida";
import { GraficaIngresosTotales } from "../charts/GraficaIngresosTotales";
import { GraficaTotalGastos } from "../charts/GraficaTotalGastos";
import {
  generateYears,
  getMonths,
  getCurrentMonth,
  getCurrentYear,
  getFilterOptions,
} from "../../../utils/dateUtils";
import { useChartData } from "../../../utils/useChartData";

export const Slider1 = () => {
  // Obtener datos para generar años dinámicos
  const { data, availableYears, loading } = useChartData();

  const [filterType, setFilterType] = useState("meses");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());

  const months = getMonths();
  // Usar años dinámicos si están disponibles, sino generar con datos disponibles
  const years =
    availableYears.length > 0
      ? availableYears.slice().reverse() // Años más recientes primero
      : generateYears(data.registroFechas, data.data);

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
        <div className="chart-item">
          <div className="chart-container-large">
            <GraficaGananciaPerdida filters={filters} />
          </div>
        </div>

        <div className="chart-item">
          <div className="chart-container-large">
            <GraficaIngresosTotales filters={filters} />
          </div>
        </div>

        <div className="chart-item">
          <div className="chart-container-large">
            <GraficaTotalGastos filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
};

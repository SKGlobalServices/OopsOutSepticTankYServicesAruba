
import React, { useState } from "react";
import { GraficaGananciaPerdida } from "../charts/GraficaGananciaPerdida";
import { GraficaIngresosTotales } from "../charts/GraficaIngresosTotales";
import { GraficaTotalGastos } from "../charts/GraficaTotalGastos";
import { generateYears, getMonths, getCurrentMonth, getCurrentYear } from "../../../utils/dateUtils";

export const Slider1 = () => {
  const [filterType, setFilterType] = useState("mes");
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());

  const months = getMonths();
  const years = generateYears();

  const filters = {
    type: filterType,
    month: selectedMonth,
    year: selectedYear
  };

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
            <option value="mes">Por Mes</option>
            <option value="año">Por Año</option>
          </select>
        </div>

        {filterType === "mes" && (
          <div className="filter-group">
            <label>Mes:</label>
            <select 
              className="filter-select-global"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group">
          <label>Año:</label>
          <select 
            className="filter-select-global"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          >
            {years.map(year => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Gráficas */}
      <div className="charts-grid">
        <div className="chart-item">
          <div className="chart-item-header">
            <h3>Ganancia/Pérdida</h3>
          </div>
          <div className="chart-container-large">
            <GraficaGananciaPerdida filters={filters} />
          </div>
        </div>

        <div className="chart-item">
          <div className="chart-item-header">
            <h3>Ingresos Totales</h3>
          </div>
          <div className="chart-container-large">
            <GraficaIngresosTotales filters={filters} />
          </div>
        </div>

        <div className="chart-item">
          <div className="chart-item-header">
            <h3>Total de Gastos</h3>
          </div>
          <div className="chart-container-large">
            <GraficaTotalGastos filters={filters} />
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { GraficaServicios } from "../charts/GraficaServicios";
import { GraficaFacturasDeudas } from "../charts/GraficaFacturasDeudas";
import { GraficaGarantias } from "../charts/GraficaGarantias";
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

export const Slider3 = () => {
  // Obtener datos para generar años dinámicos
  const { data, availableYears, loading } = useChartData();

  // Estados para filtros de Servicios
  const [serviciosFilterType, setServiciosFilterType] = useState("meses");
  const [serviciosMonth, setServiciosMonth] = useState(getCurrentMonth());
  const [serviciosYear, setServiciosYear] = useState(getCurrentYear());
  // En vista "días" se muestran todos los días del mes; no se requiere estado de día

  // Estados para filtros de Facturas y Deudas
  const [facturasFilterType, setFacturasFilterType] = useState("meses");
  const [facturasMonth, setFacturasMonth] = useState(getCurrentMonth());
  const [facturasYear, setFacturasYear] = useState(getCurrentYear());
  // En vista "días" se muestran todos los días del mes; no se requiere estado de día

  // Estados para filtros de Garantías
  const [garantiasFilterType, setGarantiasFilterType] = useState("meses");
  const [garantiasMonth, setGarantiasMonth] = useState(getCurrentMonth());
  const [garantiasYear, setGarantiasYear] = useState(getCurrentYear());
  // En vista "días" se muestran todos los días del mes; no se requiere estado de día

  const months = getMonths();
  // Usar años dinámicos si están disponibles, sino generar con datos disponibles
  const years =
    availableYears.length > 0
      ? availableYears.slice().reverse() // Años más recientes primero
      : generateYears(data.registroFechas, data.data);

  // Generar días del mes seleccionado para cada gráfica
  // No se requieren arrays de días

  // Actualizar días cuando cambien los meses o años
  // Sin selectores de día

  // Obtener opciones de filtro para cada gráfica
  const serviciosFilterOptions = getFilterOptions(serviciosFilterType);
  const facturasFilterOptions = getFilterOptions(facturasFilterType);
  const garantiasFilterOptions = getFilterOptions(garantiasFilterType);

  // Filtros para cada gráfica
  const serviciosFilters = {
    type: serviciosFilterType,
    month: serviciosMonth,
    year: serviciosYear,
  };

  const facturasFilters = {
    type: facturasFilterType,
    month: facturasMonth,
    year: facturasYear,
  };

  const garantiasFilters = {
    type: garantiasFilterType,
    month: garantiasMonth,
    year: garantiasYear,
  };

  // Mostrar indicador de carga mientras se cargan los años
  if (loading && years.length === 0) {
    return (
      <div className="charts-grid">
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
    <div className="charts-grid">
      {/* Gráfica de Servicios */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Servicios</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={serviciosFilterType}
              onChange={(e) => setServiciosFilterType(e.target.value)}
            >
              <option value="días">Días</option>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="años">Años</option>
            </select>
            {serviciosFilterOptions.needsMonth && (
              <select
                className="small-filter"
                value={serviciosMonth}
                onChange={(e) => setServiciosMonth(parseInt(e.target.value))}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            )}
            {serviciosFilterOptions.needsYear && (
              <select
                className="small-filter"
                value={serviciosYear}
                onChange={(e) => setServiciosYear(parseInt(e.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
            {/* Sin selector de día */}
          </div>
        </div>
        <div className="chart-container-large">
          <GraficaServicios filters={serviciosFilters} />
        </div>
      </div>

      {/* Gráfica de Facturas y Deudas */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Facturas y Deudas</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={facturasFilterType}
              onChange={(e) => setFacturasFilterType(e.target.value)}
            >
              <option value="días">Días</option>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="años">Años</option>
            </select>
            {facturasFilterOptions.needsMonth && (
              <select
                className="small-filter"
                value={facturasMonth}
                onChange={(e) => setFacturasMonth(parseInt(e.target.value))}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            )}
            {facturasFilterOptions.needsYear && (
              <select
                className="small-filter"
                value={facturasYear}
                onChange={(e) => setFacturasYear(parseInt(e.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
            {/* Sin selector de día */}
          </div>
        </div>
        <div className="chart-container-large">
          <GraficaFacturasDeudas filters={facturasFilters} />
        </div>
      </div>

      {/* Gráfica de Garantías */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Garantías</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={garantiasFilterType}
              onChange={(e) => setGarantiasFilterType(e.target.value)}
            >
              <option value="días">Días</option>
              <option value="semanas">Semanas</option>
              <option value="meses">Meses</option>
              <option value="años">Años</option>
            </select>
            {garantiasFilterOptions.needsMonth && (
              <select
                className="small-filter"
                value={garantiasMonth}
                onChange={(e) => setGarantiasMonth(parseInt(e.target.value))}
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            )}
            {garantiasFilterOptions.needsYear && (
              <select
                className="small-filter"
                value={garantiasYear}
                onChange={(e) => setGarantiasYear(parseInt(e.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
            {/* Sin selector de día */}
          </div>
        </div>
        <div className="chart-container-large">
          <GraficaGarantias filters={garantiasFilters} />
        </div>
      </div>
    </div>
  );
};

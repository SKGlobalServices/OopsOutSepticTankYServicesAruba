import React, { useState } from "react";
import { GraficaServicios } from "../charts/GraficaServicios";
import { GraficaFacturasDeudas } from "../charts/GraficaFacturasDeudas";
import { GraficaGarantias } from "../charts/GraficaGarantias";
import {
  generateYears,
  getMonths,
  getCurrentMonth,
  getCurrentYear,
} from "../../../utils/dateUtils";
import { useChartData } from "../../../utils/useChartData";

export const Slider3 = () => {
  // Obtener datos para generar años dinámicos
  const { data, availableYears, loading } = useChartData();

  // Estados para filtros de Servicios
  const [serviciosFilterType, setServiciosFilterType] = useState("mes");
  const [serviciosMonth, setServiciosMonth] = useState(getCurrentMonth());
  const [serviciosYear, setServiciosYear] = useState(getCurrentYear());

  // Estados para filtros de Facturas y Deudas
  const [facturasFilterType, setFacturasFilterType] = useState("mes");
  const [facturasMonth, setFacturasMonth] = useState(getCurrentMonth());
  const [facturasYear, setFacturasYear] = useState(getCurrentYear());

  // Estados para filtros de Garantías
  const [garantiasFilterType, setGarantiasFilterType] = useState("mes");
  const [garantiasMonth, setGarantiasMonth] = useState(getCurrentMonth());
  const [garantiasYear, setGarantiasYear] = useState(getCurrentYear());

  const months = getMonths();
  // Usar años dinámicos si están disponibles, sino generar con datos disponibles
  const years =
    availableYears.length > 0
      ? availableYears.slice().reverse() // Años más recientes primero
      : generateYears(data.registroFechas, data.data);

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
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {serviciosFilterType === "mes" && (
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
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {facturasFilterType === "mes" && (
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
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {garantiasFilterType === "mes" && (
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
          </div>
        </div>
        <div className="chart-container-large">
          <GraficaGarantias filters={garantiasFilters} />
        </div>
      </div>
    </div>
  );
};

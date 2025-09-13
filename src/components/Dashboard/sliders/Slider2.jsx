import React, { useState } from "react";
import { GraficaTransferencias } from "../charts/GraficaTransferencias";
import { GraficaEfectivo } from "../charts/GraficaEfectivo";
import { GraficaIntercambio } from "../charts/GraficaIntercambio";
import { DebugChart } from "../charts/DebugChart";
import {
  generateYears,
  getMonths,
  getCurrentMonth,
  getCurrentYear,
} from "../../../utils/dateUtils";
import { getArubanBanks } from "../../../utils/bankUtils";
import { useChartData } from "../../../utils/useChartData";

export const Slider2 = () => {
  // Obtener datos para generar años dinámicos
  const { data, availableYears, loading } = useChartData();

  // Estados para filtros de Transferencias
  const [transferenciasBanco, setTransferenciasBanco] = useState("todos");
  const [transferenciasFilterType, setTransferenciasFilterType] =
    useState("mes");
  const [transferenciasMonth, setTransferenciasMonth] = useState(
    getCurrentMonth()
  );
  const [transferenciasYear, setTransferenciasYear] = useState(
    getCurrentYear()
  );

  // Estados para filtros de Efectivo
  const [efectivoFilterType, setEfectivoFilterType] = useState("mes");
  const [efectivoMonth, setEfectivoMonth] = useState(getCurrentMonth());
  const [efectivoYear, setEfectivoYear] = useState(getCurrentYear());

  // Estados para filtros de Intercambios
  const [intercambioFilterType, setIntercambioFilterType] = useState("mes");
  const [intercambioMonth, setIntercambioMonth] = useState(getCurrentMonth());
  const [intercambioYear, setIntercambioYear] = useState(getCurrentYear());

  const months = getMonths();
  const bancos = getArubanBanks();

  // Usar años dinámicos si están disponibles, sino generar con datos disponibles
  const years =
    availableYears.length > 0
      ? availableYears.slice().reverse() // Años más recientes primero
      : generateYears(data.registroFechas, data.data);

  // Filtros para cada gráfica
  const transferenciasFilters = {
    banco: transferenciasBanco,
    type: transferenciasFilterType,
    month: transferenciasMonth,
    year: transferenciasYear,
  };

  const efectivoFilters = {
    type: efectivoFilterType,
    month: efectivoMonth,
    year: efectivoYear,
  };

  const intercambioFilters = {
    type: intercambioFilterType,
    month: intercambioMonth,
    year: intercambioYear,
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
      {/* Gráfica de Transferencias */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Transferencias</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={transferenciasBanco}
              onChange={(e) => setTransferenciasBanco(e.target.value)}
            >
              {bancos.map((banco) => (
                <option key={banco.value} value={banco.value}>
                  {banco.label}
                </option>
              ))}
            </select>
            <select
              className="small-filter"
              value={transferenciasFilterType}
              onChange={(e) => setTransferenciasFilterType(e.target.value)}
            >
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {transferenciasFilterType === "mes" && (
              <select
                className="small-filter"
                value={transferenciasMonth}
                onChange={(e) =>
                  setTransferenciasMonth(parseInt(e.target.value))
                }
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
              value={transferenciasYear}
              onChange={(e) => setTransferenciasYear(parseInt(e.target.value))}
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
          <GraficaTransferencias filters={transferenciasFilters} />
        </div>
      </div>

      {/* Gráfica de Efectivo */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Efectivo</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={efectivoFilterType}
              onChange={(e) => setEfectivoFilterType(e.target.value)}
            >
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {efectivoFilterType === "mes" && (
              <select
                className="small-filter"
                value={efectivoMonth}
                onChange={(e) => setEfectivoMonth(parseInt(e.target.value))}
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
              value={efectivoYear}
              onChange={(e) => setEfectivoYear(parseInt(e.target.value))}
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
          <GraficaEfectivo filters={efectivoFilters} />
        </div>
      </div>

      {/* Gráfica de Intercambios */}
      <div className="chart-item">
        <div className="chart-item-header">
          <h3>Intercambios</h3>
          <div className="chart-filters">
            <select
              className="small-filter"
              value={intercambioFilterType}
              onChange={(e) => setIntercambioFilterType(e.target.value)}
            >
              <option value="mes">Mes</option>
              <option value="año">Año</option>
            </select>
            {intercambioFilterType === "mes" && (
              <select
                className="small-filter"
                value={intercambioMonth}
                onChange={(e) => setIntercambioMonth(parseInt(e.target.value))}
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
              value={intercambioYear}
              onChange={(e) => setIntercambioYear(parseInt(e.target.value))}
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
          <GraficaIntercambio filters={intercambioFilters} />
        </div>
      </div>
    </div>
  );
};

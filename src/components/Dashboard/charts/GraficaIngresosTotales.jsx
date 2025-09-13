import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processIngresosTotalesData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaIngresosTotales.css";

// Componente de tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="ingresos-tooltip">
        <div className="ingresos-tooltip-header">{label}</div>
        <div className="ingresos-tooltip-content">
          <div className="ingresos-tooltip-row">
            <span>Transferencias: {formatCurrency(data.transferencias)}</span>
          </div>
          <div className="ingresos-tooltip-row">
            <span>Efectivo: {formatCurrency(data.efectivo)}</span>
          </div>
          <div className="ingresos-tooltip-row">
            <span>Intercambios: {formatCurrency(data.intercambios)}</span>
          </div>
          <div className="ingresos-tooltip-total">
            <span>Total: {formatCurrency(data.total)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaIngresosTotales = ({ filters }) => {
  const { data, loading, error } = useChartData();

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];

    return processIngresosTotalesData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  // Calcular totales
  const totales = React.useMemo(() => {
    if (!chartData || chartData.length === 0)
      return {
        transferencias: 0,
        efectivo: 0,
        intercambios: 0,
        total: 0,
      };

    return {
      transferencias: chartData.reduce(
        (sum, item) => sum + item.transferencias,
        0
      ),
      efectivo: chartData.reduce((sum, item) => sum + item.efectivo, 0),
      intercambios: chartData.reduce((sum, item) => sum + item.intercambios, 0),
      total: chartData.reduce((sum, item) => sum + item.total, 0),
    };
  }, [chartData]);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="ingresos-chart-container">
        <div className="ingresos-chart-content">
          <div className="ingresos-chart-loading">
            Cargando datos de ingresos...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="ingresos-chart-container">
        <div className="ingresos-chart-content">
          <div className="ingresos-chart-no-data">
            <div>⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje cuando no hay datos
  if (!chartData || chartData.length === 0) {
    return (
      <div className="ingresos-chart-container">
        <div className="ingresos-chart-header">
          <div className="ingresos-chart-title">Ingresos Totales</div>
          <div className="ingresos-totals-summary">
            <span className="ingresos-total-value">{formatCurrency(0)}</span>
          </div>
        </div>
        <div className="ingresos-chart-content">
          <div className="ingresos-chart-no-data">
            <div>💰</div>
            <div>No hay ingresos registrados</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        <div className="ingresos-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="ingresos-chart-container">
      <div className="ingresos-chart-header">
        <div className="ingresos-chart-title">Ingresos Totales</div>
        <div className="ingresos-totals-summary">
          <span className="ingresos-total-value">
            {formatCurrency(totales.total)}
          </span>
          <span className="ingresos-total-label">Total Ingresos</span>
        </div>
      </div>

      <div className="ingresos-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="#f1f5f9"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={3}
              fill="url(#totalGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda de tipos de ingreso */}
      <div className="ingresos-legend">
        <div className="ingresos-legend-item">
          <div className="ingresos-legend-color transferencias"></div>
          <span>Transferencias: {formatCurrency(totales.transferencias)}</span>
        </div>
        <div className="ingresos-legend-item">
          <div className="ingresos-legend-color efectivo"></div>
          <span>Efectivo: {formatCurrency(totales.efectivo)}</span>
        </div>
        <div className="ingresos-legend-item">
          <div className="ingresos-legend-color intercambios"></div>
          <span>Intercambios: {formatCurrency(totales.intercambios)}</span>
        </div>
      </div>

      <div className="ingresos-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

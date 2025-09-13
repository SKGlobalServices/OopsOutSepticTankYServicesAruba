import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processGananciaPerdidaData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaGananciaPerdida.css";

// Componente de tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const ganancia = data.ingresos - data.gastos;
    const isGanancia = ganancia >= 0;

    return (
      <div className="ganancia-tooltip">
        <div className="ganancia-tooltip-header">{label}</div>
        <div className="ganancia-tooltip-content">
          <div className="ganancia-tooltip-row ingresos">
            <span>💰 Ingresos: {formatCurrency(data.ingresos)}</span>
          </div>
          <div className="ganancia-tooltip-row gastos">
            <span>💸 Gastos: {formatCurrency(data.gastos)}</span>
          </div>
          <div
            className={`ganancia-tooltip-result ${
              isGanancia ? "profit" : "loss"
            }`}
          >
            <span>
              {isGanancia ? "📈" : "📉"} {isGanancia ? "Ganancia" : "Pérdida"}:{" "}
              {formatCurrency(Math.abs(ganancia))}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaGananciaPerdida = ({ filters }) => {
  const { data, loading, error } = useChartData();

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !data?.gastos || !filters)
      return [];

    return processGananciaPerdidaData(
      data.registroFechas,
      data.data,
      data.gastos,
      filters
    );
  }, [data, filters]);

  // Calcular totales y resultados
  const totales = React.useMemo(() => {
    if (!chartData || chartData.length === 0)
      return {
        ingresos: 0,
        gastos: 0,
        ganancia: 0,
        isGanancia: true,
      };

    const totalIngresos = chartData.reduce(
      (sum, item) => sum + item.ingresos,
      0
    );
    const totalGastos = chartData.reduce((sum, item) => sum + item.gastos, 0);
    const ganancia = totalIngresos - totalGastos;

    return {
      ingresos: totalIngresos,
      gastos: totalGastos,
      ganancia: Math.abs(ganancia),
      isGanancia: ganancia >= 0,
    };
  }, [chartData]);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="ganancia-chart-container">
        <div className="ganancia-chart-content">
          <div className="ganancia-chart-loading">
            Cargando análisis de ganancia/pérdida...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="ganancia-chart-container">
        <div className="ganancia-chart-content">
          <div className="ganancia-chart-no-data">
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
      <div className="ganancia-chart-container">
        <div className="ganancia-chart-header">
          <div className="ganancia-chart-title">Ganancia o Pérdida</div>
          <div className="ganancia-summary">
            <span className="ganancia-result neutral">Sin datos</span>
          </div>
        </div>
        <div className="ganancia-chart-content">
          <div className="ganancia-chart-no-data">
            <div>📊</div>
            <div>No hay datos disponibles</div>
            <div>para calcular ganancia/pérdida</div>
          </div>
        </div>
        <div className="ganancia-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="ganancia-chart-container">
      <div className="ganancia-chart-header">
        <div className="ganancia-chart-title">Ganancia o Pérdida</div>
        <div className="ganancia-summary">
          <span
            className={`ganancia-result ${
              totales.isGanancia ? "profit" : "loss"
            }`}
          >
            {totales.isGanancia ? "📈" : "📉"}{" "}
            {formatCurrency(totales.ganancia)}
          </span>
          <span className="ganancia-label">
            {totales.isGanancia ? "Ganancia" : "Pérdida"} Total
          </span>
        </div>
      </div>

      <div className="ganancia-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 20,
            }}
          >
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
            <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="rect" />
            <Bar
              dataKey="ingresos"
              fill="#10b981"
              name="Ingresos"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
            <Bar
              dataKey="gastos"
              fill="#ef4444"
              name="Gastos"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            />
            <Line
              type="monotone"
              dataKey="ganancia"
              stroke="#6366f1"
              strokeWidth={3}
              name="Ganancia Neta"
              dot={{ fill: "#6366f1", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: "#6366f1", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Resumen de totales */}
      <div className="ganancia-totales-summary">
        <div className="ganancia-total-item">
          <span className="ganancia-total-label">Total Ingresos:</span>
          <span className="ganancia-total-value ingresos">
            {formatCurrency(totales.ingresos)}
          </span>
        </div>
        <div className="ganancia-total-item">
          <span className="ganancia-total-label">Total Gastos:</span>
          <span className="ganancia-total-value gastos">
            {formatCurrency(totales.gastos)}
          </span>
        </div>
        <div className="ganancia-total-item resultado">
          <span className="ganancia-total-label">Resultado:</span>
          <span
            className={`ganancia-total-value ${
              totales.isGanancia ? "profit" : "loss"
            }`}
          >
            {totales.isGanancia ? "+" : "-"}
            {formatCurrency(totales.ganancia)}
          </span>
        </div>
      </div>

      <div className="ganancia-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

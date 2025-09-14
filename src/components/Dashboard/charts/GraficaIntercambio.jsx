import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { useChartData } from "../../../utils/useChartData";
import {
  processIntercambiosData,
  formatCurrency,
  formatTooltip,
} from "../../../utils/chartDataUtils";
import { formatFilterDate } from "../../../utils/dateUtils";
import "./Styles/GraficaIntercambio.css";

// Componente personalizado para etiquetas de intercambio
const IntercambioLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  return (
    <text
      x={x + width / 2}
      y={y - 5}
      fill="#8b5cf6"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
    >
      {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
    </text>
  );
};

export const GraficaIntercambio = ({ filters }) => {
  const { loading, error, data } = useChartData();

  if (loading) {
    return (
      <div className="chart-placeholder-large">
        <div className="intercambio-chart-loading">Cargando datos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-placeholder-large">
        <div className="intercambio-chart-error">Error: {error}</div>
      </div>
    );
  }

  const chartData = processIntercambiosData(
    data.registroFechas,
    data.data,
    filters
  );

  if (!chartData || chartData.length === 0) {
    return (
      <div className="chart-placeholder-large">
        <div className="intercambio-chart-no-data">
          No hay datos de intercambios para los filtros seleccionados
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="intercambio-tooltip">
          <p className="intercambio-tooltip-title">{label}</p>
          <p className="intercambio-tooltip-value">
            {formatTooltip(data.valor, data.cantidad)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Calcular totales
  const totalValor = chartData.reduce((sum, item) => sum + item.valor, 0);
  const totalCantidad = chartData.reduce((sum, item) => sum + item.cantidad, 0);

  return (
    <div className="intercambio-chart-container">
      {/* Indicador de totales */}
      <div className="intercambio-totals-indicator">
        <div>Total: {formatCurrency(totalValor)}</div>
        <div className="intercambio-totals-count">
          {totalCantidad} registros
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#64748b" }}
            stroke="#e2e8f0"
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#64748b" }}
            stroke="#e2e8f0"
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="valor"
            fill="#8b5cf6"
            name="Intercambios"
            radius={[4, 4, 0, 0]}
          >
            <LabelList content={<IntercambioLabel />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Indicador de filtros activos */}
      <div className="intercambio-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

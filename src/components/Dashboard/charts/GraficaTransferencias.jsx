import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { useChartData } from "../../../utils/useChartData";
import {
  processTransferenciasData,
  formatCurrency,
  formatTooltip,
} from "../../../utils/chartDataUtils";
import { getBankShortName } from "../../../utils/bankUtils";
import { formatFilterDate } from "../../../utils/dateUtils";
import "./Styles/GraficaTransferencias.css";

// Componente personalizado para etiquetas de transferencias
const TransferenciasLabel = (props) => {
  const { x, y, value, index } = props;
  if (!value || value === 0 || !x || !y || index === undefined) return null;

  // Solo mostrar etiquetas en algunos puntos para evitar saturación
  const showLabel = index % 2 === 0; // Mostrar cada segunda etiqueta
  if (!showLabel) return null;

  return (
    <text
      x={x}
      y={y - 8}
      fill="#3b82f6"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
    >
      {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
    </text>
  );
};

export const GraficaTransferencias = ({ filters }) => {
  const { loading, error, data } = useChartData();

  if (loading) {
    return (
      <div className="chart-placeholder-large">
        <div className="transferencias-chart-loading">Cargando datos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chart-placeholder-large">
        <div className="transferencias-chart-error">Error: {error}</div>
      </div>
    );
  }

  const chartData = processTransferenciasData(
    data.registroFechas,
    data.data,
    filters
  );

  if (!chartData || chartData.length === 0) {
    return (
      <div className="chart-placeholder-large">
        <div className="transferencias-chart-no-data">
          No hay datos de transferencias para los filtros seleccionados
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="transferencias-tooltip">
          <p className="transferencias-tooltip-title">{label}</p>
          <p className="transferencias-tooltip-value">
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
    <div className="transferencias-chart-container">
      {/* Indicador de totales */}
      <div className="transferencias-totals-indicator">
        <div>Total: {formatCurrency(totalValor)}</div>
        <div className="transferencias-totals-count">
          {totalCantidad} registros
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
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
          <Line
            type="monotone"
            dataKey="valor"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
            activeDot={{
              r: 6,
              stroke: "#3b82f6",
              strokeWidth: 2,
              fill: "white",
            }}
            name="Transferencias"
          >
            <LabelList content={<TransferenciasLabel />} />
          </Line>
        </LineChart>
      </ResponsiveContainer>

      {/* Indicador de filtros activos */}
      <div className="transferencias-filter-indicator">
        <div>{getBankShortName(filters?.banco)}</div>
        <div>
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    </div>
  );
};

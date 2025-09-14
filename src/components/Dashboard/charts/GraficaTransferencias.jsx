import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
      className="chart-bar-label"
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

  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];
    return processTransferenciasData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  const totalValor = chartData.reduce((sum, item) => sum + item.valor, 0);
  const totalCantidad = chartData.reduce((sum, item) => sum + item.cantidad, 0);

  if (loading) {
    return (
      <div className="transferencias-chart-container">
        <div className="transferencias-chart-title">Transferencias</div>
        <div className="transferencias-chart-content">
          <div className="transferencias-chart-loading">
            Cargando datos de transferencias...
          </div>
        </div>
        <div className="transferencias-filter-indicator">
          <div>{getBankShortName(filters?.banco)}</div>
          <div>
            {formatFilterDate(filters?.type, filters?.month, filters?.year)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="transferencias-chart-container">
        <div className="transferencias-chart-title">Transferencias</div>
        <div className="transferencias-chart-content">
          <div className="transferencias-chart-no-data">
            <div className="transferencias-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
        <div className="transferencias-filter-indicator">
          <div>{getBankShortName(filters?.banco)}</div>
          <div>
            {formatFilterDate(filters?.type, filters?.month, filters?.year)}
          </div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="transferencias-chart-container">
        <div className="transferencias-chart-title">Transferencias</div>
        <div className="transferencias-chart-content">
          <div className="transferencias-chart-no-data">
            <div className="transferencias-chart-no-data-icon">💳</div>
            <div>No hay transferencias registradas</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        <div className="transferencias-filter-indicator">
          <div>{getBankShortName(filters?.banco)}</div>
          <div>
            {formatFilterDate(filters?.type, filters?.month, filters?.year)}
          </div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="transferencias-tooltip">
          <div className="transferencias-tooltip-label">{label}</div>
          <div className="transferencias-tooltip-value">
            {formatTooltip(item.valor, item.cantidad)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="transferencias-chart-container">
      <div className="transferencias-chart-title">Transferencias</div>

      <div className="transferencias-totals-indicator">
        <div>Total: {formatCurrency(totalValor)}</div>
        <div className="transferencias-totals-count">
          {totalCantidad} registros
        </div>
      </div>

      <div className="transferencias-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              interval={0}
              angle={chartData.length > 6 ? -45 : 0}
              textAnchor={chartData.length > 6 ? "end" : "middle"}
              height={chartData.length > 6 ? 60 : 30}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              allowDecimals={false}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip content={<CustomTooltip />} />
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
      </div>

      <div className="transferencias-filter-indicator">
        <div>{getBankShortName(filters?.banco)}</div>
        <div>
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    </div>
  );
};

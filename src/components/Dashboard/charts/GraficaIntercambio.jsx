import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
      className="chart-bar-label"
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

  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];
    return processIntercambiosData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  const totalValor = chartData.reduce((sum, item) => sum + item.valor, 0);
  const totalCantidad = chartData.reduce((sum, item) => sum + item.cantidad, 0);

  if (loading) {
    return (
      <div className="intercambio-chart-container">
        <div className="intercambio-chart-title">Intercambios</div>
        <div className="intercambio-chart-content">
          <div className="intercambio-chart-loading">
            Cargando datos de intercambios...
          </div>
        </div>
        <div className="intercambio-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="intercambio-chart-container">
        <div className="intercambio-chart-title">Intercambios</div>
        <div className="intercambio-chart-content">
          <div className="intercambio-chart-no-data">
            <div className="intercambio-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
        <div className="intercambio-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="intercambio-chart-container">
        <div className="intercambio-chart-title">Intercambios</div>
        <div className="intercambio-chart-content">
          <div className="intercambio-chart-no-data">
            <div className="intercambio-chart-no-data-icon">🔄</div>
            <div>No hay intercambios registrados</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        <div className="intercambio-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="intercambio-tooltip">
          <div className="intercambio-tooltip-label">{label}</div>
          <div className="intercambio-tooltip-value">
            {formatTooltip(item.valor, item.cantidad)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="intercambio-chart-container">
      <div className="intercambio-chart-title">Intercambios</div>

      <div className="intercambio-totals-indicator">
        <div>Total: {formatCurrency(totalValor)}</div>
        <div className="intercambio-totals-count">
          {totalCantidad} registros
        </div>
      </div>

      <div className="intercambio-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
            <Bar
              dataKey="valor"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
              name="Intercambios"
            >
              <LabelList content={<IntercambioLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="intercambio-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

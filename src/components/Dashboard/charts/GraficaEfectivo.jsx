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
  processEfectivoData,
  formatCurrency,
  formatTooltip,
} from "../../../utils/chartDataUtils";
import { formatFilterDate } from "../../../utils/dateUtils";
import "./Styles/GraficaEfectivo.css";
import { WeekTick } from "./WeekTick";

// Componente personalizado para etiquetas de efectivo
const EfectivoLabel = (props) => {
  const { x, y, width, value } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  return (
    <text
      className="chart-bar-label"
      x={x + width / 2}
      y={y - 5}
      fill="#059669"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
    >
      {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
    </text>
  );
};

export const GraficaEfectivo = ({ filters }) => {
  const { loading, error, data } = useChartData();

  // Procesar datos solo cuando existan
  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];
    return processEfectivoData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  // Calcular totales (aunque no haya datos para mantener consistencia)
  const totalValor = chartData.reduce((sum, item) => sum + item.valor, 0);
  const totalCantidad = chartData.reduce((sum, item) => sum + item.cantidad, 0);

  // Estados de carga y error con estructura uniforme
  if (loading) {
    return (
      <div className="efectivo-chart-container">
        <div className="efectivo-chart-title">Efectivo</div>
        <div className="efectivo-chart-content">
          <div className="efectivo-chart-loading">
            Cargando datos de efectivo...
          </div>
        </div>
        <div className="efectivo-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="efectivo-chart-container">
        <div className="efectivo-chart-title">Efectivo</div>
        <div className="efectivo-chart-content">
          <div className="efectivo-chart-no-data">
            <div className="efectivo-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
        <div className="efectivo-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="efectivo-chart-container">
        <div className="efectivo-chart-title">Efectivo</div>
        <div className="efectivo-chart-content">
          <div className="efectivo-chart-no-data">
            <div className="efectivo-chart-no-data-icon">💵</div>
            <div>No hay efectivo registrado</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        <div className="efectivo-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="efectivo-tooltip">
          <div className="efectivo-tooltip-label">{label}</div>
          <div className="efectivo-tooltip-value">
            {formatTooltip(item.valor, item.cantidad)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="efectivo-chart-container">
      <div className="efectivo-chart-title">Efectivo</div>

      <div className="efectivo-totals-indicator">
        <div>Total: {formatCurrency(totalValor)}</div>
        <div className="efectivo-totals-count">{totalCantidad} registros</div>
      </div>

      <div className="efectivo-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={filters?.type === "semanas" ? <WeekTick /> : { fontSize: 10 }}
              interval={0}
              angle={filters?.type === "semanas" ? 0 : chartData.length > 3 ? -90 : 0}
              textAnchor={filters?.type === "semanas" ? "end" : chartData.length > 3 ? "end" : "middle"}
              height={filters?.type === "semanas" ? 70 : chartData.length > 3 ? 60 : 30}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              allowDecimals={false}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="valor"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              name="Efectivo"
            >
              <LabelList content={<EfectivoLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="efectivo-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

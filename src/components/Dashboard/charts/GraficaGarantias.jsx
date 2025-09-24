// Gráfica de conteo de garantías de las tablas registrofechas y data
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import { processGarantiasData } from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaGarantias.css";
import { WeekTick } from "./WeekTick";

// Componente personalizado para etiquetas de garantías
const GarantiasLabel = (props) => {
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
      {value}
    </text>
  );
};

// Componente de tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="garantias-tooltip">
        <div className="garantias-tooltip-label">{label}</div>
        <div className="garantias-tooltip-value">
          {`Garantías: ${data.garantias}`}
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaGarantias = ({ filters }) => {
  const { data, loading, error } = useChartData();

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];

    return processGarantiasData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="garantias-chart-container">
        <div className="garantias-chart-title">Conteo de Garantías</div>
        <div className="garantias-chart-content">
          <div className="garantias-chart-loading">
            Cargando datos de garantías...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="garantias-chart-container">
        <div className="garantias-chart-title">Conteo de Garantías</div>
        <div className="garantias-chart-content">
          <div className="garantias-chart-no-data">
            <div className="garantias-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje cuando no hay datos
  if (!chartData || chartData.length === 0) {
    return (
      <div className="garantias-chart-container">
        <div className="garantias-chart-title">Conteo de Garantías</div>
        <div className="garantias-chart-content">
          <div className="garantias-chart-no-data">
            <div className="garantias-chart-no-data-icon">🛡️</div>
            <div>No hay garantías registradas</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        {/* Indicador de filtros activos */}
        <div className="garantias-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="garantias-chart-container">
      <div className="garantias-chart-title">Conteo de Garantías</div>

      {/* Indicador de totales - similar al de servicios */}
      <div className="garantias-totals-indicator">
        <div>
          Total: {chartData.reduce((sum, item) => sum + item.garantias, 0)}{" "}
          garantías
        </div>
        <div className="garantias-totals-count">
          {chartData.reduce((sum, item) => sum + item.cantidad, 0)} registros
        </div>
      </div>

      <div className="garantias-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 30,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={filters?.type === "semanas" ? <WeekTick /> : { fontSize: 12 }}
              interval={0}
              angle={filters?.type === "semanas" ? 0 : chartData.length > 3 ? -90 : 0}
              textAnchor={filters?.type === "semanas" ? "end" : chartData.length > 3 ? "end" : "middle"}
              height={filters?.type === "semanas" ? 70 : chartData.length > 3 ? 60 : 30}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="garantias"
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
              name="Garantías"
            >
              <LabelList content={<GarantiasLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Indicador de filtros activos */}
      <div className="garantias-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

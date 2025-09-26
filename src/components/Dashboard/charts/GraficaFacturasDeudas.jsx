// Gráfica de facturas pendientes y deudas de la tabla facturas
import React from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processFacturasData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaFacturasDeudas.css";
import { WeekTick } from "./WeekTick";

// Componente personalizado para etiquetas de facturas
const FacturasLabel = (props) => {
  const { x, y, width, value, filters } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  // Rotar texto a vertical cuando se filtra por días
  const isVertical = filters?.type === "días";
  const transform = isVertical ? `rotate(-90, ${x + width / 2}, ${y - 5})` : undefined;

  return (
    <text
      className="chart-bar-label"
      x={x + width / 2}
      y={y - 5}
      fill="#3b82f6"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
      transform={transform}
    >
      {value}
    </text>
  );
};

// Componente personalizado para etiquetas de deuda
const DeudaLabel = (props) => {
  const { x, y, width, value, filters } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  // Rotar texto a vertical cuando se filtra por días
  const isVertical = filters?.type === "días";
  const transform = isVertical ? `rotate(-90, ${x + width / 2}, ${y - 5})` : undefined;

  return (
    <text
      className="chart-bar-label"
      x={x + width / 2}
      y={y - 5}
      fill="#f59e0b"
      textAnchor="middle"
      fontSize="10"
      fontWeight="600"
      transform={transform}
    >
      {value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
    </text>
  );
};

// Componente de tooltip personalizado más limpio
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="facturas-tooltip">
        <div className="facturas-tooltip-header">{label}</div>
        <div className="facturas-tooltip-content">
          <div className="facturas-tooltip-row">
            <div className="facturas-tooltip-color facturas-color"></div>
            <span>Pendientes: {data.facturas}</span>
          </div>
          <div className="facturas-tooltip-row">
            <div className="facturas-tooltip-color deuda-color"></div>
            <span>Deuda: {formatCurrency(data.deuda)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaFacturasDeudas = ({ filters }) => {
  const { data, loading, error } = useChartData();

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    if (!data?.facturas || !filters) return [];

    return processFacturasData(data.facturas, filters);
  }, [data, filters]);

  // Calcular totales
  const totales = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return { facturas: 0, deuda: 0 };

    return {
      facturas: chartData.reduce((sum, item) => sum + item.facturas, 0),
      deuda: chartData.reduce((sum, item) => sum + item.deuda, 0),
    };
  }, [chartData]);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="facturas-chart-container">
        <div className="facturas-chart-title">Facturas Pendientes y Deudas</div>
        <div className="facturas-chart-content">
          <div className="facturas-chart-loading">
            Cargando datos de facturas...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="facturas-chart-container">
        <div className="facturas-chart-title">Facturas Pendientes y Deudas</div>
        <div className="facturas-chart-content">
          <div className="facturas-chart-no-data">
            <div className="facturas-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje cuando no hay datos
  if (!chartData || chartData.length === 0) {
    return (
      <div className="facturas-chart-container">
        <div className="facturas-chart-title">Facturas Pendientes y Deudas</div>
        <div className="facturas-chart-content">
          <div className="facturas-chart-no-data">
            <div className="facturas-chart-no-data-icon">📄</div>
            <div>No hay facturas pendientes</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        {/* Indicador de filtros activos */}
        <div className="facturas-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="facturas-chart-container">
      <div className="facturas-chart-header">
        <div className="facturas-chart-title">Facturas Pendientes y Deudas</div>

        {/* Indicador de totales más limpio */}
        <div className="facturas-totals-summary">
          <div className="facturas-total-item">
            <span className="facturas-total-value">{totales.facturas}</span>
            <span className="facturas-total-label">Pendientes</span>
          </div>
          <div className="facturas-total-divider"></div>
          <div className="facturas-total-item">
            <span className="facturas-total-value">
              {formatCurrency(totales.deuda)}
            </span>
            <span className="facturas-total-label">Total Deuda</span>
          </div>
        </div>
      </div>

      <div className="facturas-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 35,
              right: 40,
              left: 40,
              bottom: 20,
            }}
            barGap={10}
          >
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="#f1f5f9"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              tick={filters?.type === "semanas" ? <WeekTick /> : { fontSize: 12}}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={filters?.type === "semanas" ? 0 : chartData.length > 3 ? -90 : 0}
              textAnchor={filters?.type === "semanas" ? "end" : chartData.length > 3 ? "end" : "middle"}
              height={filters?.type === "semanas" ? 72 : chartData.length > 3 ? 60 : 30}
            />
            <YAxis
              yAxisId="facturas"
              orientation="left"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={35}
            />
            <YAxis
              yAxisId="deuda"
              orientation="right"
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              yAxisId="facturas"
              dataKey="facturas"
              fill="#3b82f6"
              radius={[3, 3, 0, 0]}
              name="Facturas Pendientes"
              maxBarSize={60}
            >
              <LabelList content={(props) => <FacturasLabel {...props} filters={filters} />} />
            </Bar>
            <Bar
              yAxisId="deuda"
              dataKey="deuda"
              fill="#f59e0b"
              radius={[3, 3, 0, 0]}
              name="Total Deuda"
              maxBarSize={60}
            >
              <LabelList content={(props) => <DeudaLabel {...props} filters={filters} />} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Indicador de filtros más discreto */}
      <div className="facturas-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

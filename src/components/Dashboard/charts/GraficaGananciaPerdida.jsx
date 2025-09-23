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
  Cell,
  LabelList,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processGananciaPerdidaData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaGananciaPerdida.css";
import { WeekTick } from "./WeekTick";

// Componente personalizado para etiquetas de ingresos
const IngresosLabel = (props) => {
  const { x, y, width, value, index } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  // Detectar si es móvil basado en el ancho de la ventana
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth <= 480;

  // Ajustar tamaño de fuente según el dispositivo
  const fontSize = isSmallMobile ? "12" : isMobile ? "13" : "10";

  // En móviles pequeños, mostrar solo cada segundo label para evitar saturación
  if (isSmallMobile && index !== undefined && index % 2 !== 0) return null;

  return (
    <text
      className="chart-bar-label"
      x={x + width / 2}
      y={y - (isMobile ? 10 : 5)}
      fill="#059669"
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="700"
      style={{
        textShadow: isMobile
          ? "2px 2px 4px rgba(255, 255, 255, 0.9)"
          : "1px 1px 2px rgba(255, 255, 255, 0.8)",
        filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.1))",
      }}
    >
      {value > 1000 ? `${(value / 1000).toFixed(0)}k` : value}
    </text>
  );
};

// Componente personalizado para etiquetas de gastos
const GastosLabel = (props) => {
  const { x, y, width, value, index } = props;
  if (!value || value === 0 || !x || !y || !width) return null;

  // Detectar si es móvil basado en el ancho de la ventana
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth <= 480;

  // Ajustar tamaño de fuente según el dispositivo
  const fontSize = isSmallMobile ? "12" : isMobile ? "13" : "10";

  // En móviles pequeños, mostrar solo cada segundo label para evitar saturación
  if (isSmallMobile && index !== undefined && index % 2 !== 0) return null;

  return (
    <text
      x={x + width / 2}
      y={y - (isMobile ? 10 : 5)}
      fill="#dc2626"
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="700"
      style={{
        textShadow: isMobile
          ? "2px 2px 4px rgba(255, 255, 255, 0.9)"
          : "1px 1px 2px rgba(255, 255, 255, 0.8)",
        filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.1))",
      }}
    >
      {value > 1000 ? `${(value / 1000).toFixed(0)}k` : value}
    </text>
  );
};

// Componente personalizado para etiquetas de ganancia en la línea
const GananciaLabel = (props) => {
  const { x, y, payload, index } = props;
  if (!payload || payload.ganancia === undefined || !x || !y) return null;

  const ganancia = payload.ganancia;
  const isPositive = ganancia >= 0;

  // Detectar si es móvil basado en el ancho de la ventana
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const isSmallMobile =
    typeof window !== "undefined" && window.innerWidth <= 480;

  // Ajustar tamaño de fuente según el dispositivo
  const fontSize = isSmallMobile ? "13" : isMobile ? "14" : "10";

  // En móviles pequeños, mostrar solo cada segundo label
  if (isSmallMobile && index !== undefined && index % 2 !== 0) return null;

  return (
    <text
      x={x}
      y={y - (isMobile ? 15 : 10)}
      fill={isPositive ? "#059669" : "#dc2626"}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="800"
      style={{
        textShadow: isMobile
          ? "2px 2px 4px rgba(255, 255, 255, 0.9)"
          : "1px 1px 2px rgba(255, 255, 255, 0.8)",
        filter: "drop-shadow(1px 1px 2px rgba(0,0,0,0.1))",
      }}
    >
      {isPositive ? "+" : ""}
      {ganancia > 1000
        ? `${(ganancia / 1000).toFixed(1)}k`
        : ganancia.toFixed(0)}
    </text>
  );
};

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
              top:
                typeof window !== "undefined" && window.innerWidth <= 768
                  ? 45
                  : 35,
              right:
                typeof window !== "undefined" && window.innerWidth <= 768
                  ? 35
                  : 30,
              left:
                typeof window !== "undefined" && window.innerWidth <= 768
                  ? 25
                  : 20,
              bottom:
                typeof window !== "undefined" && window.innerWidth <= 768
                  ? 25
                  : 20,
            }}
          >
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="#f1f5f9"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              tick={filters?.type === "semanas" ? <WeekTick /> : { fontSize: 12 }}
              interval={0}
              angle={chartData.length > 3 ? -45 : 0}
              textAnchor={chartData.length > 3 ? "end" : "middle"}
              height={chartData.length > 3 ? 60 : 30}
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
            >
              <LabelList content={<IngresosLabel />} />
            </Bar>
            <Bar
              dataKey="gastos"
              fill="#ef4444"
              name="Gastos"
              radius={[4, 4, 0, 0]}
              opacity={0.8}
            >
              <LabelList content={<GastosLabel />} />
            </Bar>
            <Line
              type="monotone"
              dataKey="ganancia"
              stroke="#6366f1"
              strokeWidth={3}
              name="Ganancia Neta"
              dot={{ fill: "#6366f1", strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, stroke: "#6366f1", strokeWidth: 2 }}
            >
              <LabelList content={<GananciaLabel />} />
            </Line>
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

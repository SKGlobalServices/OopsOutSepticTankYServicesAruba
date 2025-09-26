import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Area,
  Line,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processIngresosTotalesData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaIngresosTotales.css";
import { WeekTick } from "./WeekTick";


// Variante que centra la etiqueta sobre la barra (usa props de LabelList: x, y, width, value)
const IngresosTotalBarLabel = (props) => {
  const { x, y, width, value, filters } = props;
  if (!value || value === 0 || x === undefined || y === undefined || !width)
    return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  const fontSize = isMobile ? 11 : 10;
  const display = value > 1000 ? `${(value / 1000).toFixed(1)}k` : value;
  
  // Rotar texto a vertical cuando se filtra por días
  const isVertical = filters?.type === "días";
  const transform = isVertical ? `rotate(-90, ${x - 4}, ${y - 11})` : undefined;

  return (
    <text
      className="chart-bar-label"
      x={x + width / 2}
      y={y - (isMobile ? 8 : 6)}
      fill="#0f172a"
      stroke="#ffffff"
      strokeWidth={isMobile ? 2 : 1}
      paintOrder="stroke fill"
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight="700"
      transform={transform}
    >
      {display}
    </text>
  );
};

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
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 768;
  // Estado local para togglear la visibilidad de cada tipo en la gráfica
  const [visible, setVisible] = React.useState({
    transferencias: true,
    efectivo: true,
    intercambios: true,
  });

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
        <div className="ingresos-totals-indicator">
          <div>Total: {formatCurrency(0)}</div>
          <div className="ingresos-totals-count">Cargando...</div>
        </div>
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
        <div className="ingresos-totals-indicator">
          <div>Total: {formatCurrency(0)}</div>
          <div className="ingresos-totals-count">Error</div>
        </div>
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
        {/* Indicador de totales - siempre visible */}
        <div className="ingresos-totals-indicator">
          <div>Total: {formatCurrency(totales.total)}</div>
          <div className="ingresos-totals-count">0 períodos</div>
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
      </div>

      <div className="ingresos-totals-indicator">
        <div>Total: {formatCurrency(totales.total)}</div>
        <div className="ingresos-totals-count">{chartData.length} períodos</div>
      </div>

      <div className="ingresos-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 30,
              right: 30,
              left: 20,
              bottom: 5,
            }}
            barCategoryGap={isMobile ? "10%" : "18%"}
            barGap={isMobile ? 2 : 4}
          >
            <defs>
              <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 2"
              stroke="#f1f5f9"
              opacity={0.6}
            />
            <XAxis
              dataKey="name"
              tick={
                filters?.type === "semanas" ? <WeekTick /> : { fontSize: 12 }
              }
              axisLine={false}
              tickLine={false}
              // Forzar que se muestren todos los ticks (cada día) usando interval=0
              interval={0}
              angle={
                filters?.type === "semanas" ? 0 : chartData.length > 3 ? -90 : 0
              }
              textAnchor={
                filters?.type === "semanas"
                  ? "end"
                  : chartData.length > 3
                  ? "end"
                  : "middle"
              }
              height={
                filters?.type === "semanas"
                  ? 72
                  : chartData.length > 3
                  ? 60
                  : 30
              }
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => {
                // Mostrar en formato compacto (k) pero con separación de miles para valores pequeños
                if (Math.abs(value) >= 1000)
                  return `${(value / 1000).toFixed(0)}k`;
                return value;
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Área y línea de tendencia detrás de las barras para dar sensación de continuidad */}
            <Area
              type="monotone"
              dataKey="total"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#totalGradient)"
              isAnimationActive={true}
              animationDuration={700}
            />
            <Line
              type="monotone"
              dataKey="total"
              strokeWidth={2}
              dot={{ r: isMobile ? 2 : 3 }}
              activeDot={{ r: isMobile ? 4 : 6 }}
              isAnimationActive={true}
              animationDuration={700}
            />

            {/* Barras apiladas por tipo de ingreso (mejor lectura de composición) */}
            {visible.transferencias && (
              <Bar
                dataKey="transferencias"
                name="Transferencias"
                stackId="a"
                fill="#8b5cf6"
                barSize={isMobile ? 10 : 16}
                isAnimationActive={true}
                animationDuration={600}
                aria-label="Transferencias"
              />
            )}
            {visible.efectivo && (
              <Bar
                dataKey="efectivo"
                name="Efectivo"
                stackId="a"
                fill="#059669"
                barSize={isMobile ? 10 : 16}
                isAnimationActive={true}
                animationDuration={600}
                aria-label="Efectivo"
              />
            )}
            {visible.intercambios && (
              <Bar
                dataKey="intercambios"
                name="Intercambios"
                stackId="a"
                fill="#f59e0b"
                barSize={isMobile ? 10 : 16}
                isAnimationActive={true}
                animationDuration={600}
                aria-label="Intercambios"
              />
            )}

            {/* Barra invisible separada para mostrar las etiquetas del total (debe ir al final para que las etiquetas queden encima) */}
            <Bar
              dataKey="total"
              fill="transparent"
              barSize={isMobile ? 10 : 16}
              isAnimationActive={false}
            >
              <LabelList dataKey="total" content={(props) => <IngresosTotalBarLabel {...props} filters={filters} />} />
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda de tipos de ingreso */}
      <div className="ingresos-legend">
        {/** Legend interactivity: click to toggle series visibility */}
        <div
          className={`ingresos-legend-item ${
            visible.transferencias ? "active" : "muted"
          }`}
          onClick={() =>
            setVisible((s) => ({ ...s, transferencias: !s.transferencias }))
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            setVisible((s) => ({ ...s, transferencias: !s.transferencias }))
          }
        >
          <div className="ingresos-legend-color transferencias"></div>
          <span>Transferencias: {formatCurrency(totales.transferencias)}</span>
        </div>

        <div
          className={`ingresos-legend-item ${
            visible.efectivo ? "active" : "muted"
          }`}
          onClick={() => setVisible((s) => ({ ...s, efectivo: !s.efectivo }))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            setVisible((s) => ({ ...s, efectivo: !s.efectivo }))
          }
        >
          <div className="ingresos-legend-color efectivo"></div>
          <span>Efectivo: {formatCurrency(totales.efectivo)}</span>
        </div>

        <div
          className={`ingresos-legend-item ${
            visible.intercambios ? "active" : "muted"
          }`}
          onClick={() =>
            setVisible((s) => ({ ...s, intercambios: !s.intercambios }))
          }
          role="button"
          tabIndex={0}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            setVisible((s) => ({ ...s, intercambios: !s.intercambios }))
          }
        >
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

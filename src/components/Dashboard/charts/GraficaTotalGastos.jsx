import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import {
  processGastosData,
  formatCurrency,
} from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaTotalGastos.css";

// Componente de tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="gastos-tooltip">
        <div className="gastos-tooltip-header">{label}</div>
        <div className="gastos-tooltip-content">
          <div>Total: {formatCurrency(data.total)}</div>
          <div>{data.cantidad} gastos</div>
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaTotalGastos = ({ filters }) => {
  const { data, loading, error } = useChartData();

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    const processed = processGastosData(data.gastos, filters);
    console.log("Datos procesados en memo:", processed);
    return processed;
  }, [data, filters]);

  // Calcular total
  const totalGastos = chartData.reduce((sum, item) => sum + item.total, 0);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="gastos-chart-container">
        <div className="gastos-chart-content">
          <div className="gastos-chart-loading">
            Cargando datos de gastos...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="gastos-chart-container">
        <div className="gastos-chart-content">
          <div className="gastos-chart-no-data">
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
      <div className="gastos-chart-container">
        <div className="gastos-chart-header">
          <div className="gastos-chart-title">Total de Gastos</div>
          <div className="gastos-totals-summary">
            <span className="gastos-total-value">{formatCurrency(0)}</span>
          </div>
        </div>
        <div className="gastos-chart-content">
          <div className="gastos-chart-no-data">
            <div>📊</div>
            <div>No hay gastos registrados</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        <div className="gastos-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="gastos-chart-container">
      <div className="gastos-chart-header">
        <div className="gastos-chart-title">Total de Gastos</div>
        <div className="gastos-totals-summary">
          <span className="gastos-total-value">
            {formatCurrency(totalGastos)}
          </span>
          <span className="gastos-total-label">Total Gastado</span>
        </div>
      </div>

      <div className="gastos-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
            <Bar
              dataKey="total"
              fill="#ef4444"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="gastos-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

// Gráfica de conteo de servicios de las tablas registrofechas y data
import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";
import { processServiciosData } from "../../../utils/chartDataUtils";
import { useChartData } from "../../../utils/useChartData";
import "./Styles/GraficaServicios.css";

// Componente de tooltip personalizado
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="servicios-tooltip">
        <div className="servicios-tooltip-label">{label}</div>
        <div className="servicios-tooltip-value">
          {`Servicios: ${data.servicios}`}
        </div>
      </div>
    );
  }
  return null;
};

export const GraficaServicios = ({ filters }) => {
  const { registroFechas, data, loading, error } = useChartData();

  // Debug: mostrar qué datos estamos recibiendo
  React.useEffect(() => {
    console.log("🔍 GraficaServicios - Estado del hook:", {
      loading,
      error,
      dataStructure: data,
      registroFechasFromData: data?.registroFechas
        ? Object.keys(data.registroFechas).length
        : 0,
      dataTableFromData: data?.data ? Object.keys(data.data).length : 0,
      filters,
    });
  }, [registroFechas, data, loading, error, filters]);

  // Procesar datos solo cuando tenemos información y filtros
  const chartData = React.useMemo(() => {
    if (!data?.registroFechas || !data?.data || !filters) return [];

    return processServiciosData(data.registroFechas, data.data, filters);
  }, [data, filters]);

  // Mostrar estado de carga
  if (loading) {
    return (
      <div className="servicios-chart-container">
        <div className="servicios-chart-title">Conteo de Servicios</div>
        <div className="servicios-chart-content">
          <div className="servicios-chart-loading">
            Cargando datos de servicios...
          </div>
        </div>
      </div>
    );
  }

  // Mostrar error si existe
  if (error) {
    return (
      <div className="servicios-chart-container">
        <div className="servicios-chart-title">Conteo de Servicios</div>
        <div className="servicios-chart-content">
          <div className="servicios-chart-no-data">
            <div className="servicios-chart-no-data-icon">⚠️</div>
            <div>Error al cargar datos: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Mostrar mensaje cuando no hay datos
  if (!chartData || chartData.length === 0) {
    return (
      <div className="servicios-chart-container">
        <div className="servicios-chart-title">Conteo de Servicios</div>
        <div className="servicios-chart-content">
          <div className="servicios-chart-no-data">
            <div className="servicios-chart-no-data-icon">📊</div>
            <div>No hay servicios registrados</div>
            <div>para el período seleccionado</div>
          </div>
        </div>
        {/* Indicador de filtros activos */}
        <div className="servicios-filter-indicator">
          {formatFilterDate(filters?.type, filters?.month, filters?.year)}
        </div>
      </div>
    );
  }

  return (
    <div className="servicios-chart-container">
      <div className="servicios-chart-title">Conteo de Servicios</div>

      {/* Indicador de totales - similar al de efectivo */}
      <div className="servicios-totals-indicator">
        <div>
          Total: {chartData.reduce((sum, item) => sum + item.servicios, 0)}{" "}
          servicios
        </div>
        <div className="servicios-totals-count">
          {chartData.reduce((sum, item) => sum + item.cantidad, 0)} registros
        </div>
      </div>

      <div className="servicios-chart-content">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
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
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="servicios"
              fill="#06b6d4"
              radius={[4, 4, 0, 0]}
              name="Servicios"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Indicador de filtros activos */}
      <div className="servicios-filter-indicator">
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

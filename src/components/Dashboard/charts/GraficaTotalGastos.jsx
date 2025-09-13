import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { formatFilterDate } from "../../../utils/dateUtils";

// TODO: total gastos + mes se muestran las semanas y si es año se muestran los meses
export const GraficaTotalGastos = ({ filters }) => {
  // Datos de ejemplo que cambiarían según los filtros
  const getDataByFilter = () => {
    if (filters?.type === "mes") {
      // Datos por semanas del mes
      return [
        { name: "Semana 1", gastos: 1200 },
        { name: "Semana 2", gastos: 980 },
        { name: "Semana 3", gastos: 1500 },
        { name: "Semana 4", gastos: 1100 },
      ];
    } else {
      // Datos por meses del año
      return [
        { name: "Enero", gastos: 4000 },
        { name: "Febrero", gastos: 3200 },
        { name: "Marzo", gastos: 4500 },
        { name: "Abril", gastos: 3800 },
        { name: "Mayo", gastos: 4200 },
        { name: "Junio", gastos: 3900 },
      ];
    }
  };

  const data = getDataByFilter();

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="gastos" fill="#f43f5e" />
        </BarChart>
      </ResponsiveContainer>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px' }}>
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

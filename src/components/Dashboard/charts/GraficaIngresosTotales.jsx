
import React from "react";
import { formatFilterDate } from "../../../utils/dateUtils";

export const GraficaIngresosTotales = ({ filters }) => {
  // TODO: Implementar lógica de filtros
  // filters.type: "mes" o "año"
  // filters.month: número del mes (1-12)
  // filters.year: año seleccionado
  
  return (
    <div className="chart-placeholder-large">
      <div className="large-chart-area">
        <div className="area-fill" style={{ background: 'linear-gradient(to top, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))' }}></div>
      </div>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px' }}>
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

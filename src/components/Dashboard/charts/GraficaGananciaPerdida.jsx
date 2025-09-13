
import React from "react";
import { formatFilterDate } from "../../../utils/dateUtils";

export const GraficaGananciaPerdida = ({ filters }) => {
  // TODO: Implementar lógica de filtros
  // filters.type: "mes" o "año"
  // filters.month: número del mes (1-12)
  // filters.year: año seleccionado
  
  return (
    <div className="chart-placeholder-large">
      <div className="large-chart-line">
        <div className="line-path"></div>
      </div>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: '4px' }}>
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

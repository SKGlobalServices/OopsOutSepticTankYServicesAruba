// TODO:Conteo de todas las casillas en blanco y conteo total de deudas de esas
import React from "react";
import { formatFilterDate } from "../../../utils/dateUtils";

export const GraficaFacturasDeudas = ({ filters }) => {
  // TODO: Implementar lógica de filtros
  // filters.type: "mes" o "año"
  // filters.month: número del mes (1-12)
  // filters.year: año seleccionado

  return (
    <div className="chart-placeholder-large">
      <div className="large-chart-pie" style={{ background: 'conic-gradient(#ef4444 0deg 180deg, #f59e0b 180deg 270deg, #10b981 270deg 360deg)' }}>
        <div style={{ background: 'white', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>
          Facturas
        </div>
      </div>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px' }}>
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

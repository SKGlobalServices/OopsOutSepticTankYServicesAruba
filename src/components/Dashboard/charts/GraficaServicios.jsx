// TODO: me traigo fecha  registrofechay data,  agregar filtros para mes y año y banco
import React from "react";
import { formatFilterDate } from "../../../utils/dateUtils";

export const GraficaServicios = ({ filters }) => {
  // TODO: Implementar lógica de filtros
  // filters.type: "mes" o "año"
  // filters.month: número del mes (1-12)
  // filters.year: año seleccionado

  return (
    <div className="chart-placeholder-large">
      <div className="large-chart-bars">
        <div className="large-bar" style={{ height: '70%', background: '#06b6d4' }}></div>
        <div className="large-bar" style={{ height: '85%', background: '#3b82f6' }}></div>
        <div className="large-bar" style={{ height: '55%', background: '#8b5cf6' }}></div>
        <div className="large-bar" style={{ height: '95%', background: '#10b981' }}></div>
        <div className="large-bar" style={{ height: '75%', background: '#f59e0b' }}></div>
        <div className="large-bar" style={{ height: '65%', background: '#ef4444' }}></div>
      </div>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px' }}>
        {formatFilterDate(filters?.type, filters?.month, filters?.year)}
      </div>
    </div>
  );
};

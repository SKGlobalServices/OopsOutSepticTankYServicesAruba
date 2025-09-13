// TODO: me traigo fecha, formadepago, valor, banco de registro de fechas y data,  agregar filtros para mes y año y banco
import React from "react";
import { getBankShortName } from "../../../utils/bankUtils";
import { formatFilterDate } from "../../../utils/dateUtils";

export const GraficaTransferencias = ({ filters }) => {
  // TODO: Implementar lógica de filtros
  // filters.banco: "todos", "aruba_bank", "caribbean_mercantile", "rbc_royal"
  // filters.type: "mes" o "año"
  // filters.month: número del mes (1-12)
  // filters.year: año seleccionado

  return (
    <div className="chart-placeholder-large">
      <div className="large-chart-bars">
        <div className="large-bar" style={{ height: '60%', background: '#3b82f6' }}></div>
        <div className="large-bar" style={{ height: '80%', background: '#10b981' }}></div>
        <div className="large-bar" style={{ height: '45%', background: '#f59e0b' }}></div>
        <div className="large-bar" style={{ height: '90%', background: '#8b5cf6' }}></div>
        <div className="large-bar" style={{ height: '70%', background: '#ef4444' }}></div>
      </div>
      {/* Indicador de filtros activos para desarrollo */}
      <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', maxWidth: '150px', textAlign: 'right' }}>
        <div>{getBankShortName(filters?.banco)}</div>
        <div>{formatFilterDate(filters?.type, filters?.month, filters?.year)}</div>
      </div>
    </div>
  );
};

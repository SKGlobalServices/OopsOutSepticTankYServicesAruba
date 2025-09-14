import React from "react";
import { useChartData } from "../../../utils/useChartData";

export const DebugChart = () => {
  const { loading, error, data } = useChartData();

  if (loading) {
    return <div>Cargando datos de Firebase...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const registroFechasKeys = Object.keys(data.registroFechas);
  const dataKeys = Object.keys(data.data);

  // Contar registros de transferencias
  let transferenciasCount = 0;
  let efectivoCount = 0;
  let intercambioCount = 0;
  const formasPagoEncontradas = new Set();

  // Función auxiliar para normalizar forma de pago
  const normalizeFormaPago = (record) => {
    return (record.formadepago || record.metododepago || '').toLowerCase().trim();
  };

  // Contar en registrofechas
  registroFechasKeys.forEach(fecha => {
    const registros = data.registroFechas[fecha];
    Object.values(registros).forEach(record => {
      const formaPago = normalizeFormaPago(record);
      formasPagoEncontradas.add(formaPago);
      if (formaPago === 'transferencia') transferenciasCount++;
      if (formaPago === 'efectivo') efectivoCount++;
      if (formaPago === 'intercambio') intercambioCount++;
    });
  });

  // Contar en data
  Object.values(data.data).forEach(record => {
    const formaPago = normalizeFormaPago(record);
    formasPagoEncontradas.add(formaPago);
    if (formaPago === 'transferencia') transferenciasCount++;
    if (formaPago === 'efectivo') efectivoCount++;
    if (formaPago === 'intercambio') intercambioCount++;
  });

  // Calcular totales de valores
  let totalTransferenciasValor = 0;
  let totalEfectivoValor = 0;
  let totalIntercambioValor = 0;

  // Calcular totales en registrofechas
  registroFechasKeys.forEach(fecha => {
    const registros = data.registroFechas[fecha];
    Object.values(registros).forEach(record => {
      const formaPago = normalizeFormaPago(record);
      const valor = parseFloat(record.valor) || 0;
      if (formaPago === 'transferencia') totalTransferenciasValor += valor;
      if (formaPago === 'efectivo') totalEfectivoValor += valor;
      if (formaPago === 'intercambio') totalIntercambioValor += valor;
    });
  });

  // Calcular totales en data
  Object.values(data.data).forEach(record => {
    const formaPago = normalizeFormaPago(record);
    const valor = parseFloat(record.valor) || 0;
    if (formaPago === 'transferencia') totalTransferenciasValor += valor;
    if (formaPago === 'efectivo') totalEfectivoValor += valor;
    if (formaPago === 'intercambio') totalIntercambioValor += valor;
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'AWG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', margin: '10px' }}>
      <h3>🔍 Debug de Datos Firebase</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h4>Estructura de Datos:</h4>
          <p><strong>RegistroFechas:</strong> {registroFechasKeys.length} fechas</p>
          <p><strong>Data:</strong> {dataKeys.length} registros</p>
        </div>
        <div>
          <h4>Conteo por Forma de Pago:</h4>
          <p><strong>Transferencias:</strong> {transferenciasCount} registros - {formatCurrency(totalTransferenciasValor)}</p>
          <p><strong>Efectivo:</strong> {efectivoCount} registros - {formatCurrency(totalEfectivoValor)}</p>
          <p><strong>Intercambio:</strong> {intercambioCount} registros - {formatCurrency(totalIntercambioValor)}</p>
          <p><strong>Formas de pago encontradas:</strong></p>
          <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
            {Array.from(formasPagoEncontradas).map(forma => (
              <li key={forma} style={{ fontSize: '12px' }}>{forma || '(vacío)'}</li>
            ))}
          </ul>
        </div>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <h4>Primeras 3 fechas en RegistroFechas:</h4>
        <pre style={{ background: '#e9ecef', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
          {JSON.stringify(registroFechasKeys.slice(0, 3), null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h4>Primeros 3 registros de Data:</h4>
        <pre style={{ background: '#e9ecef', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
          {JSON.stringify(Object.entries(data.data).slice(0, 3), null, 2)}
        </pre>
      </div>
    </div>
  );
};

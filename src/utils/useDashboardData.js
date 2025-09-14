import { useState, useEffect, useMemo } from 'react';
import { database } from '../Database/firebaseConfig';
import { get, ref } from 'firebase/database';

// Hook personalizado para obtener y procesar datos del dashboard
export const useDashboardData = (filters) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    gastos: [],
    registroFechas: [],
    facturasEmitidas: []
  });
  const [error, setError] = useState(null);

  // Función para obtener datos de Firebase
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener datos de las 3 tablas principales
      const [gastosSnapshot, registroFechasSnapshot, facturasSnapshot] = await Promise.all([
        get(ref(database, "gastos")),
        get(ref(database, "registroFechas")),
        get(ref(database, "facturasemitidas"))
      ]);

      setData({
        gastos: gastosSnapshot.val() || {},
        registroFechas: registroFechasSnapshot.val() || {},
        facturasEmitidas: facturasSnapshot.val() || {}
      });

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ejecutar fetch al montar el componente
  useEffect(() => {
    fetchData();
  }, []);

  // Funciones de utilidad para filtrar datos
  const filterByDate = (records, filters) => {
    return Object.entries(records).filter(([key, record]) => {
      if (!record.fecha) return false;
      
      const recordDate = new Date(record.fecha);
      const recordMonth = recordDate.toLocaleString('es-ES', { month: 'long' });
      const recordYear = recordDate.getFullYear().toString();
      
      const monthMatch = filters.mes === 'Todos' || recordMonth.toLowerCase() === filters.mes.toLowerCase();
      const yearMatch = filters.año === 'Todos' || recordYear === filters.año;
      
      return monthMatch && yearMatch;
    });
  };

  const filterByBank = (records, banco) => {
    if (banco === 'Todos') return records;
    return records.filter(([key, record]) => record.banco === banco);
  };

  // Datos procesados y calculados
  const processedData = useMemo(() => {
    if (loading) return null;

    // 1. Total de Gastos (filtrado por fecha)
    const filteredGastos = filterByDate(data.gastos, filters);
    const totalGastos = filteredGastos.reduce((sum, [key, gasto]) => {
      return sum + (parseFloat(gasto.valor) || 0);
    }, 0);

    // 2. Datos de registroFechas filtrados
    let filteredRegistroFechas = filterByDate(data.registroFechas, filters);
    filteredRegistroFechas = filterByBank(filteredRegistroFechas, filters.banco);

    // 3. Total Transferencias
    const totalTransferencias = filteredRegistroFechas
      .filter(([key, record]) => record.formadepago === 'transferencia')
      .reduce((sum, [key, record]) => sum + (parseFloat(record.valor) || 0), 0);

    // 4. Total Efectivo
    const totalEfectivo = filteredRegistroFechas
      .filter(([key, record]) => record.formadepago === 'efectivo')
      .reduce((sum, [key, record]) => sum + (parseFloat(record.valor) || 0), 0);

    // 5. Total Intercambio
    const totalIntercambio = filteredRegistroFechas
      .filter(([key, record]) => record.formadepago === 'intercambio')
      .reduce((sum, [key, record]) => sum + (parseFloat(record.valor) || 0), 0);

    // 6. Conteo de Servicios
    const conteoServicios = filteredRegistroFechas.length;

    // 7. Facturas y Deudas (filtrado por fecha)
    const filteredFacturas = filterByDate(data.facturasEmitidas, filters);
    const facturasEnBlanco = filteredFacturas.filter(([key, factura]) => 
      !factura.pago || factura.pago.trim() === ''
    ).length;
    
    const totalDeudas = filteredFacturas
      .filter(([key, factura]) => !factura.pago || factura.pago.trim() === '')
      .reduce((sum, [key, factura]) => sum + (parseFloat(factura.total) || 0), 0);

    // 8. Conteo de Garantías
    const conteoGarantias = filteredRegistroFechas
      .filter(([key, record]) => record.formadepago === 'garantia')
      .length;

    // 9. Ingresos Totales (suma de transferencias + efectivo + intercambio)
    const ingresosTotales = totalTransferencias + totalEfectivo + totalIntercambio;

    // 10. Ganancia/Pérdida (ingresos - gastos)
    const gananciaPerdida = ingresosTotales - totalGastos;

    return {
      totalGastos,
      totalTransferencias,
      totalEfectivo, 
      totalIntercambio,
      conteoServicios,
      facturasEnBlanco,
      totalDeudas,
      conteoGarantias,
      ingresosTotales,
      gananciaPerdida,
      // Datos raw para gráficas más complejas
      gastosDetallados: filteredGastos,
      registroFechasDetallado: filteredRegistroFechas,
      facturasDetalladas: filteredFacturas
    };
  }, [data, filters, loading]);

  return {
    loading,
    error,
    data: processedData,
    refetch: fetchData
  };
};

import { useState, useEffect } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { extractYearsFromData } from "./dateUtils";

/**
 * Hook personalizado para obtener datos de Firebase para las gráficas
 * @returns {Object} Estado de carga, datos, años disponibles y función de recarga
 */
export const useChartData = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    registroFechas: {},
    data: {},
    facturas: {},
    gastos: {},
  });
  const [error, setError] = useState(null);
  const [loadedRegistro, setLoadedRegistro] = useState(false);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedFacturas, setLoadedFacturas] = useState(false);
  const [loadedGastos, setLoadedGastos] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    // Cargar datos de registrofechas
    const registroRef = ref(database, "registrofechas");
    const unsubscribeRegistro = onValue(registroRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          setData((prev) => ({
            ...prev,
            registroFechas: snapshot.val(),
          }));
        } else {
          setData((prev) => ({
            ...prev,
            registroFechas: {},
          }));
        }
        setLoadedRegistro(true);
      } catch (err) {
        console.error("Error loading registrofechas:", err);
        setError(err.message);
        setLoadedRegistro(true);
      }
    });

    // Cargar datos de data
    const dataRef = ref(database, "data");
    const unsubscribeData = onValue(dataRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          setData((prev) => ({
            ...prev,
            data: snapshot.val(),
          }));
        } else {
          setData((prev) => ({
            ...prev,
            data: {},
          }));
        }
        setLoadedData(true);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message);
        setLoadedData(true);
      }
    });

    // Cargar datos de facturas
    const facturasRef = ref(database, "facturas");
    const unsubscribeFacturas = onValue(facturasRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          setData((prev) => ({
            ...prev,
            facturas: snapshot.val(),
          }));
        } else {
          setData((prev) => ({
            ...prev,
            facturas: {},
          }));
        }
        setLoadedFacturas(true);
      } catch (err) {
        console.error("Error loading facturas:", err);
        setError(err.message);
        setLoadedFacturas(true);
      }
    });

    // Cargar datos de gastos
    const gastosRef = ref(database, "gastos");
    const unsubscribeGastos = onValue(gastosRef, (snapshot) => {
      try {
        if (snapshot.exists()) {
          setData((prev) => ({
            ...prev,
            gastos: snapshot.val(),
          }));
        } else {
          setData((prev) => ({
            ...prev,
            gastos: {},
          }));
        }
        setLoadedGastos(true);
      } catch (err) {
        console.error("Error loading gastos:", err);
        setError(err.message);
        setLoadedGastos(true);
      }
    });

    // Cleanup function
    return () => {
      unsubscribeRegistro();
      unsubscribeData();
      unsubscribeFacturas();
      unsubscribeGastos();
    };
  }, []);

  // Actualizar años disponibles cuando cambien los datos
  useEffect(() => {
    if (loadedRegistro && loadedData && loadedFacturas && loadedGastos) {
      const years = extractYearsFromData(data.registroFechas, data.data);
      setAvailableYears(years);
      setLoading(false);
    }
  }, [
    data.registroFechas,
    data.data,
    data.facturas,
    data.gastos,
    loadedRegistro,
    loadedData,
    loadedFacturas,
    loadedGastos,
  ]);

  return {
    loading,
    error,
    data,
    availableYears,
    refetch: () => {
      setLoadedRegistro(false);
      setLoadedData(false);
      setLoadedFacturas(false);
      setLoadedGastos(false);
      setLoading(true);
    },
  };
};

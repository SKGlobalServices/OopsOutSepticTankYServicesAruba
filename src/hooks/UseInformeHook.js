import { useEffect, useState } from "react";
import {
  subscribeClients,
  subscribeData,
  subscribeInformedeefectivo,
  subscribeRegistroFechas,
  subscribeUsers,
} from "../services/informeSourceService";

// Hook de lectura compartida para el informe de efectivo.
// Centraliza las suscripciones a Firebase para que los componentes consuman datos ya normalizados.

export const useInformeSourceData = () => {
  // Estados locales que guardan cada rama fuente del informe.
  const [registroFechasData, setRegistroFechasData] = useState([]);
  const [dataData, setDataData] = useState([]);
  const [dataInformedeefectivoData, setInformedeefectivoData] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loadedRegistroFechas, setLoadedRegistroFechas] = useState(false);
  const [loadedData, setLoadedData] = useState(false);
  const [loadedInformeEfectivo, setLoadedInformeEfectivo] = useState(false);
  const [loadedUsers, setLoadedUsers] = useState(false);
  const [loadedClients, setLoadedClients] = useState(false);

  // Suscripción a la rama histórica que alimenta el informe desde registrofechas.
  useEffect(() => {
    const unsubscribe = subscribeRegistroFechas(
      (records) => {
        setRegistroFechasData(records);
        setLoadedRegistroFechas(true);
      },
      (error) => {
        console.error("Error loading registrofechas:", error);
        setLoadedRegistroFechas(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Suscripción a la rama operativa del día, usada como otra fuente de materialización.
  useEffect(() => {
    const unsubscribe = subscribeData(
      (records) => {
        setDataData(records);
        setLoadedData(true);
      },
      (error) => {
        console.error("Error loading data:", error);
        setLoadedData(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Suscripción al espejo materializado que consumen las pantallas del informe.
  useEffect(() => {
    const unsubscribe = subscribeInformedeefectivo(
      (records) => {
        setInformedeefectivoData(records);
        setLoadedInformeEfectivo(true);
      },
      (error) => {
        console.error("Error loading informedeefectivo:", error);
        setLoadedInformeEfectivo(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Suscripción al catálogo de usuarios para resolver ids, nombres y roles.
  useEffect(() => {
    const unsubscribe = subscribeUsers(
      (records) => {
        setAllUsers(records);
        setLoadedUsers(true);
      },
      (error) => {
        console.error("Error loading users:", error);
        setLoadedUsers(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Suscripción a clientes para completar datos auxiliares como dirección y cúbicos.
  useEffect(() => {
    const unsubscribe = subscribeClients(
      (records) => {
        setClients(records);
        setLoadedClients(true);
      },
      (error) => {
        console.error("Error loading clientes:", error);
        setLoadedClients(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // La vista se mantiene en carga hasta que todas las ramas necesarias respondan.
  const loading =
    !loadedRegistroFechas ||
    !loadedData ||
    !loadedInformeEfectivo ||
    !loadedUsers ||
    !loadedClients;

  return {
    registroFechasData,
    dataData,
    dataInformedeefectivoData,
    allUsers,
    clients,
    loading,
  };
};
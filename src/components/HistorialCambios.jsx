import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import { ref, onValue } from "firebase/database";
import Slidebar from "./Slidebar";
import Clock from "./Clock";

const HistorialCambios = () => {
  const [data, setData] = useState([]);
  const [showSlidebar, setShowSlidebar] = useState(false);
  const slidebarRef = useRef(null);

  // LOADER
  const [loading, setLoading] = useState(true);
  const [loadedData, setLoadedData] = useState(false);

  // Escucha de Firebase para "historialcambios"
  useEffect(() => {
    const dbRef = ref(database, "historialcambios");
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const entries = Object.entries(snapshot.val());
        // Ordenar por timestamp descendente (más reciente primero)
        entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
        setData(entries);
      } else {
        setData([]);
      }
      setLoadedData(true);
    }, (error) => {
      console.error("Error en historialcambios listener:", error);
      setLoadedData(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loadedData) {
      setLoading(false);
    }
  }, [loadedData]);


  const toggleSlidebar = () => setShowSlidebar(!showSlidebar);

  const handleClickOutside = (e) => {
    if (
      slidebarRef.current &&
      !slidebarRef.current.contains(e.target) &&
      !e.target.closest(".show-slidebar-button")
    ) {
      setShowSlidebar(false);
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Loading
  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader" />
      </div>
    );
  }

  return (
    <>
      <div className="homepage-container">
        <Slidebar />

        <div className="homepage-title">
          <div className="homepage-card">
            <h1 className="title-page">Historial de Cambios</h1>
            <div className="current-date">
              <div style={{ cursor: "default" }}>
                {new Date().toLocaleDateString()}
              </div>
              <Clock />
            </div>
          </div>
        </div>

        <div className="homepage-card">
          <div className="table-container">
            <table className="service-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Quien</th>
                  <th>Modulo de Cambio</th>
                  <th>Cambio</th>
                </tr>
              </thead>
              <tbody>
              {data && data.length > 0 ? (
                data.map(([id, item]) => (
                  <tr key={id}>
                    <td style={{ textAlign: "center" }}>{item.fecha || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.hora || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.usuario || ""}</td>
                    <td style={{ textAlign: "center" }}>{item.modulo || ""}</td>
                    <td style={{ textAlign: "left" }}>{item.detalle || ""}</td>
                  </tr>
                ))
              ) : (
                <tr className="no-data">
                  <td colSpan="5">No hay registros disponibles</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default React.memo(HistorialCambios);

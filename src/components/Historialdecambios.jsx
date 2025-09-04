import React, { useState, useEffect } from "react";
import Slidebar from "./Slidebar";

const Historialdecambios = () => {
  // LOADER
  const [loading, setLoading] = useState(true);

  // Simular carga inicial
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
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
    <div className="homepage-container">
      <Slidebar/>
      <h1>HISTORIAL DE CAMBIOS</h1>
    </div>
  );
};

export default Historialdecambios;

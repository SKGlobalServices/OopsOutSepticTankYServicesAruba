 import React, { useState, useEffect, useRef } from "react";
import { database } from "../Database/firebaseConfig";
import Slidebar from "./Slidebar";
import filtericon from "../assets/img/filters_icon.jpg";

const Informedecobranza = () => {
const [showSlidebar, setShowSlidebar] = useState(false);
const [showFilterSlidebar, setShowFilterSlidebar] = useState(false);
const slidebarRef = useRef(null);
 const filterSlidebarRef = useRef(null);

// Mostrar/ocultar slidebars
const toggleSlidebar = () => setShowSlidebar(!showSlidebar);
const toggleFilterSlidebar = () => setShowFilterSlidebar(!showFilterSlidebar);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        slidebarRef.current &&
        !slidebarRef.current.contains(e.target) &&
        !e.target.closest(".show-slidebar-button")
      ) {
        setShowSlidebar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="homepage-container">
      <Slidebar />
      <div onClick={() => toggleSlidebar(!showSlidebar)}></div>

      {/* FILTROS */}
      <div onClick={() => toggleFilterSlidebar(!showFilterSlidebar)}>
        <img
          src={filtericon}
          className="show-filter-slidebar-button"
          alt="Filtros"
        />
      </div>
      <div
        ref={filterSlidebarRef}
        className={`filter-slidebar ${showFilterSlidebar ? "show" : ""}`}
      >
        <h2>Filtros</h2>
        <button className="Filter-Button">
          <p>DataPicker</p>
        </button>
        <p>DataPicker</p>
        <button className="Filter-Button">
          <p>DataPicker</p>
        </button>
        <p>DataPicker</p>
        <button className="Filter-Button"></button>
        <label>Realizado Por</label>
        <select>""</select>
        <label>A Nombre De</label>
        <select>""</select>
        <label>Direccion</label>
        <select>""</select>
        <label>Servicio</label>
        <select>""</select>
        <label>Realizado Por</label>
        <select>""</select>
        <label>Cubicos</label>
        <select>""</select>
        <label>Valor</label>
        <select>""</select>
        <label>Pago</label>
        <select>""</select>
        <label>Forma De Pago</label>
        <select>""</select>
        <label>Banco</label>
        <select>""</select>
        <label>Metodo De Pago</label>
        <select>""</select>
        <label>Efectivo</label>
        <select>""</select>
        <label>Payment</label>
        <select>""</select>
        <label>N De Facturas</label>
        <input type="text" />
        <label>Factura</label>
        <select>
          <option value="all">Todos</option>
          <option value="yes">Si</option>
          <option value="no">No</option>
        </select>
        <button className="Discard-Filter-Button">
          <p>Descartar Filtros</p>
        </button>
      </div>  // aqui 

      <div className="homepage-title">
        <div className="homepage-card">
          <h1 className="title-page">Informe de Cobranza</h1>
          <div className="current-date">
            <p>Fecha</p>
            <p>Reloj</p>
          </div>
        </div>
      </div>

      <div className="homepage-card">
        <div className="table-container">
          <table className="service-table">
            <thead>
              <tr>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
                <th>th</th>
              </tr>
            </thead>
            <tbody>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
              <td>td</td>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Informedecobranza;
